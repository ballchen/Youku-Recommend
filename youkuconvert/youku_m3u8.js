var request = require('request');
var express = require('express');
var _ = require('underscore');
var url = require('url');
var http = require('http')
var PacProxyAgent = require('pac-proxy-agent');

var app = express();



var proxy = 'pac+http://yo.uku.im/proxy.pac';



function GetKeyString(seed) {
	var base_string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/\\:._-1234567890';
	var target_string = '';
	while (base_string.length != 0) {
		seed = (seed * 211 + 30031) % 65536;
		index = (seed / 65536 * base_string.length);
		target_string += base_string[parseInt(index)];
		base_string = base_string.slice(0, index) + base_string.slice(index + 1)
	}
	return target_string;
}

function GetFileId(daye_str, seed) {
	var new_list = daye_str.split("*");
	var target_string = '';
	var base_string = GetKeyString(seed);

	for (var i = 0; i < (new_list.length - 1); i++) {
		var index = parseInt(new_list[i]);
		target_string += base_string[index];
	}
	return target_string;

}

function GetMetaDataFromID(id, callback) {
	var endpoint = 'http://v.youku.com/player/getPlayList/VideoIDS/'+id+'/Pf/4/ctype/12/ev/1';
	var opts = url.parse(endpoint);
	var agent = new PacProxyAgent(proxy);
	opts.agent = agent;

	http.get(opts, function(res) {
		var data = "";
    	res.on('data', function (chunk) {
      		data += chunk;
    	});
    	res.on("end", function() {
    		var metadata = JSON.parse(data)
    		if(metadata.data[0].streamfileids['3gphd']){
    			callback(metadata.data[0]);
    		}
    		else{
    			callback("error")
    		}
      		
    	});
	}).on('error', function(e) {
		console.log("Got error: " + e.message);
	});	
}

function GenerateNewEp(vid, ep) {
	var f_code_1 = 'becaf9be', f_code_2 = 'bf7e5f01'

	function trans_e(a, c) {
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

	e_code = trans_e(f_code_1 ,new Buffer(ep, 'base64').toString('binary'))
	var e_split = e_code.split('_')
	var sid = e_split[0]
	var token = e_split[1]
	new_ep = trans_e(f_code_2, sid+"_"+vid+"_"+token)

	return [new Buffer(new_ep,'binary').toString('base64'), sid, token]
}

function GetHostFromM3u8(data){
	return 
}

function GenerateM3u8Query(vid, callback){
	GetMetaDataFromID(vid, function(metadata0){
		if(metadata0 === "error") callback("error")
		else if(!metadata0.streamfileids['3gphd']) callback("error")
		else{
			var seed = metadata0.seed
			var ep = metadata0.ep
			var daye_str = metadata0.streamfileids['3gphd']
			var EpSidToken = GenerateNewEp(vid, ep)
			
			var fileid = GetFileId(daye_str, seed);
			
			var m3u8json = {
				ts: Math.floor(Date.now() / 1000),
				ctype: 12,
				ep: EpSidToken[0],
				ev: 1,
				keyframe: 1,
				oip: metadata0.ip,
				sid: EpSidToken[1],
				token: EpSidToken[2],
				type: "mp4",
				vid: vid
			}
			var m3u8query = "http://pl.youku.com/playlist/m3u8?ts="+m3u8json.ts
							+"&token="+m3u8json.token
							+"&ev=1&sid="+m3u8json.sid
							+"&ctype=12&oip="+m3u8json.oip+"&vid="+m3u8json.vid
							+"&type=flv&keyframe=0&ep="+encodeURIComponent(m3u8json.ep)
			console.log(m3u8query)
			callback(m3u8query)
		}

		
	})
	
}

// GenerateM3u8Query('XNzYwODQ3MTg0')

// app.get('/',function(req, res){
// 	if(req.query.id){
// 		console.log(req.query)
// 		GenerateM3u8Query(req.query.id, function(uri){
// 			if(uri === 'error') return res.send("Error")
// 			res.redirect(uri)				
				
// 		})			
// 	}

// 	else return res.send("Error")
// })

app.get('/raw',function(req, res){
	if(req.query.id){
		console.log(req.query)
		GenerateM3u8Query(req.query.id, function(uri){
			if(uri === 'error') return res.send("Error")
			res.json({uri: uri+'&.mp4=1'})				
				
		})			
	}

	else return res.send("Error")
})

app.listen(8083);

	