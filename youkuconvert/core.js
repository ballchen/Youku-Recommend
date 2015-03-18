var _ = require('underscore');

exports.yk_d = function(a){
    if (!a) {
        return '';
    }
    f = a.length;
    b = 0;
    str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (c = ''; b < f;) {
        e = a.charCodeAt(b++) & 255;
        if (b == f) {
            c += str.charAt(e >> 2);
            c += str.charAt((e & 3) << 4);
            c += '==';
            break;
        }
        g = a.charCodeAt(b++);
        if (b == f) {
            c += str.charAt(e >> 2);
            c += str.charAt((e & 3) << 4 | (g & 240) >> 4);
            c += str.charAt((g & 15) << 2);
            c += '=';
            break;
        }
        h = a.charCodeAt(b++);
        c += str.charAt(e >> 2);
        c += str.charAt((e & 3) << 4 | (g & 240) >> 4);
        c += str.charAt((g & 15) << 2 | (h & 192) >> 6);
        c += str.charAt(h & 63);
    }
    return c;
}

exports.yk_e = function(a, c) {
	var f = 0, h = 0, b = [], result = '';

	for (var i = 0; i < 256; i++) {
		b[i] = i;
	}
	
	while (h < 256) {

		f = (f + b[h] + a[h % a.length].charCodeAt(0)) % 256;
		//swap
		var temp = b[h];
		b[h] = b[f];
		b[f] = temp;
		h++;
	}

	q = f = h = 0

	while (q < c.length) {
		h = (h + 1) % 256;
		f = (f + b[h]) % 256;

		//swap
		var temp = b[h];
		b[h] = b[f];
		b[f] = temp;

		if (typeof(c[q]) == Number){
			result += String.fromCharCode(c[q] ^ b[(b[h] + b[f]) % 256])
		}
		else {
			result += String.fromCharCode((c[q].charCodeAt(0)) ^ b[(b[h] + b[f]) % 256])
		}
		
		q++
	}
	return result
}



    
