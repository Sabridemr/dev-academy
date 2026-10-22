#!/usr/bin/env bash
# DevAcademy PostgreSQL yedeği (ev sunucusu, docker compose).
#
# Çalışan postgres konteynerinden pg_dump'ın özel (custom, -Fc) biçimli çıktısını alır,
# ${BACKUP_DIR}/devacademy-YYYYMMDD-HHMMSS.dump olarak yazar ve KEEP_DAYS günden eski yedekleri siler.
# pg_dump salt okunurdur; çalışan uygulamayı durdurmaya gerek yoktur.
#
# Ortam değişkenleri (hepsi isteğe bağlı):
#   BACKUP_DIR      yedek klasörü               (varsayılan: $HOME/backups/devacademy)
#   KEEP_DAYS       saklama süresi, gün         (varsayılan: 14)
#   PG_CONTAINER    postgres konteyner adı      (varsayılan: devacademy-postgres-1)
#   PG_USER         veritabanı kullanıcısı      (varsayılan: devacademy)
#   PG_DB           veritabanı adı              (varsayılan: devacademy)
#
# Cron örneği (her gece 03:00; cron'un PATH'inde docker olmalı):
#   0 3 * * * /home/<kullanıcı>/projects/dev-academy/scripts/backup-db.sh >> /home/<kullanıcı>/backups/devacademy.log 2>&1
#
# Geri yükleme (mevcut nesneleri silip yedekteki hâline döndürür; önce API'yi durdurmanız önerilir):
#   docker compose stop api web
#   docker exec -i devacademy-postgres-1 pg_restore -U devacademy -d devacademy --clean --if-exists < <dump>
#   docker compose start api web
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/devacademy}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-devacademy-postgres-1}"
PG_USER="${PG_USER:-devacademy}"
PG_DB="${PG_DB:-devacademy}"

log() { printf '%s [backup-db] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

TMP_FILE=""
on_exit() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    if [[ -n "$TMP_FILE" && -f "$TMP_FILE" ]]; then rm -f "$TMP_FILE"; fi
    log "HATA: yedekleme başarısız (çıkış kodu $code)"
  fi
  exit "$code"
}
trap on_exit EXIT

if ! [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
  log "HATA: KEEP_DAYS negatif olmayan bir tam sayı olmalı (verilen: $KEEP_DAYS)"
  exit 2
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null || true)" != "true" ]]; then
  log "HATA: '$PG_CONTAINER' konteyneri çalışmıyor"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/devacademy-$(date '+%Y%m%d-%H%M%S').dump"
# Önce geçici dosyaya yazılır: yarım kalan döküm geçerli bir yedek gibi görünmesin
TMP_FILE="$OUT_FILE.partial"

log "Yedek alınıyor: $PG_CONTAINER/$PG_DB -> $OUT_FILE"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -Fc "$PG_DB" >"$TMP_FILE"

if [[ ! -s "$TMP_FILE" ]]; then
  log "HATA: döküm dosyası boş"
  exit 1
fi
mv "$TMP_FILE" "$OUT_FILE"
TMP_FILE=""
log "Tamamlandı: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Saklama süresini aşan yedekleri sil (yalnızca bu betiğin ürettiği adlar)
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devacademy-*.dump' -mtime "+$KEEP_DAYS" -print -delete | wc -l)
log "$KEEP_DAYS günden eski $DELETED yedek silindi"
