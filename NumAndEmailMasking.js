
maskPhoneNumber("0212666624");
maskPhoneNumber("212666624");
maskPhoneNumber("0064212626624");
maskPhoneNumber("+64212626624");
maskPhoneNumber("098381574");

maskEmailAddress("abcdefg@gmail.com");
maskEmailAddress("1234567@gmail.com");
maskEmailAddress("abcd456@nsn.com");


function maskPhoneNumber(value) {
    if (value === null)
        return null;
    //  check number pattern such as  212626624 (if so, add a leading 0)
    var numWithNoLeading0 = /^([2]\d)(.*)(\d\d)$/;
    if (numWithNoLeading0.test(value))
        value = "0" + value;

    var maskOption1 = /^([0][2]\d)(.*)(\d\d)$/;//  number pattern such as  0212626624
    var maskOption2 = /^([0][0]\d\d)(.*)(\d\d)$/;//  number pattern such as  0064212626624
    var maskOption3 = /^([+]\d\d\d\d)(.*)(\d\d)$/;//  number pattern such as  +64212626624
    var maskedValue;
    // mask the number according to different number patterns
    if (maskOption1.test(value))
        maskedValue = value.replace(/^([0][2]\d)(.*)(\d\d)$/,
            (_, a, b, c) => a + b.replace(/./g, '*') + c);

    else if (maskOption2.test(value))
        maskedValue = value.replace(/^([0][0]\d\d)(.*)(\d\d)$/,
            (_, a, b, c) => a + b.replace(/./g, '*') + c);

    else if (maskOption3.test(value))
        maskedValue = value.replace(/^([+]\d\d\d\d)(.*)(\d\d)$/,
            (_, a, b, c) => a + b.replace(/./g, '*') + c);

    //Default masking will be only keeping first 3 and last 2 digits
    else
        maskedValue = value.replace(/^(\d\d\d)(.*)(\d\d)$/,
            (_, a, b, c) => a + b.replace(/./g, '*') + c);
    
    console.log(maskedValue);
    return maskedValue;
}

function maskEmailAddress(value) {
    if (value === null)
        return null;
    //Mask the email address by only keeping the first character or number before @ symbol
    var maskedValue = value.replace(/^(.)(.*)(@.*)$/,
        (_, a, b, c) => a + b.replace(/./g, '*') + c
    );
    console.log(maskedValue);
    return maskedValue;
}