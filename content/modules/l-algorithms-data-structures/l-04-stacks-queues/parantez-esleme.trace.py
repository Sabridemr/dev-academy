def dengeli_mi(metin):
    eslesme = {")": "(", "]": "[", "}": "{"}
    yigin = []
    for ch in metin:
        if ch in "([{":
            #@ Açılış parantezi yığının tepesine konuyor: en son açılan, ilk kapanmak zorunda (LIFO). | An opening bracket is pushed on top: the last one opened must be the first one closed (LIFO).
            yigin.append(ch)
        elif ch in eslesme:
            #@ Kapanış geldi: yığın boşsa ya da tepedeki açılış bu kapanışın eşi değilse metin dengesizdir. | A closer arrived: if the stack is empty or the top opener does not match it, the text is unbalanced.
            if not yigin or yigin.pop() != eslesme[ch]:
                return False
    #@ Döngü bitti: yığında kapanmamış açılış kalmadıysa metin dengelidir. | The loop is done: if no unclosed opener is left on the stack, the text is balanced.
    return not yigin


print(dengeli_mi("{[()]}"))
#@ Bu sefer ']' geldiğinde tepede '(' duruyor: eşleşme bozuk. | This time when ']' arrives the top is '(': the match fails.
print(dengeli_mi("([)]"))
