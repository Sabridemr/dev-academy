/**
 * gray-matter saplaması (stub).
 * @devacademy/shared içindeki lesson.md ayrıştırıcısı yalnızca Node/backend tarafında çalışır.
 * Mobil paket bu fonksiyonu hiç çağırmaz; çağrılırsa açık bir hata verir.
 */
function matter() {
  throw new Error(
    'gray-matter mobil uygulamada desteklenmiyor (yalnızca Node ortamında kullanılır).',
  );
}
matter.stringify = matter;
matter.read = matter;
matter.test = function () {
  return false;
};
module.exports = matter;
module.exports.default = matter;
