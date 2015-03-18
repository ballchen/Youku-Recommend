var request = require('request');
var express = require('express');
var core = require('./core')
var sohu = require('./sohu')
var url = require('url');
var http = require('http')
var cors = require('cors')
var PacProxyAgent = require('pac-proxy-agent');

var app = express();

app.use(cors())


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
	// opts.hostname = "http://www.youku.com"
	// opts.host = "218.93.248.237"
	// opts.headers = {referer: "http://www.youku.com"}
	// console.log(opts)

	http.get(opts, function(res) {
		var data = "";
    	res.on('data', function (chunk) {
      		data += chunk;
    	});
    	res.on("end", function() {
    		var metadata = JSON.parse(data)
    		if(metadata.data[0].streamfileids['mp4']){
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


function GenerateNewEp(fid, ep) {
	var f_code_1 = 'becaf9be', f_code_2 = 'bf7e5f01'

	e_code = core.yk_e(f_code_1 ,new Buffer(ep, 'base64').toString('binary'))

	var e_split = e_code.split('_')
	var sid = e_split[0]
	var token = e_split[1]
	new_ep = core.yk_d(core.yk_e(f_code_2, sid+"_"+fid+"_"+token))

	return [new_ep, sid, token]
}



function GenerateM3u8Query(vid, callback){
	GetMetaDataFromID(vid, function(metadata0){
		if(metadata0 === "error") callback("error")
		else if(!metadata0.streamfileids['3gphd']) callback("error")
		else{
			var seed = metadata0.seed
			var ep = metadata0.ep
			var daye_str = metadata0.streamfileids['3gphd']
			
			
			var fileid = GetFileId(daye_str, seed);
			var EpSidToken = GenerateNewEp(fileid, ep)
			
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
				vid: vid,
				fileid: fileid
			}
			var m3u8query = "http://pl.youku.com/playlist/m3u8?ts="+m3u8json.ts
							+"&token="+m3u8json.token
							+"&ev=1&sid="+m3u8json.sid
							+"&ctype=12&oip="+m3u8json.oip+"&vid="+m3u8json.vid
							+"&type=mp4&keyframe=1&ep="+encodeURIComponent(m3u8json.ep)

			request(m3u8query, function(err, response, body){
				if(err) callback("error")
				else if(!body.match(/http:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9.-]+\//)) callback("error")
				else{
					var host = body.match(/http:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9.-]+\//)[0]
					callback(host+fileid+".mp4")
				}
				
			})	
		}

		
	})
	
}

function GenerateMp4Query(vid, callback){
	GetMetaDataFromID(vid, function(metadata0){
		if(metadata0 === "error") callback("error")
		else if(!metadata0.streamfileids['mp4']) callback("error")
		else{
			var seed = metadata0.seed
			var ep = metadata0.ep
			var daye_str = metadata0.streamfileids['mp4']
			
			var fileid = GetFileId(daye_str, seed);
			
			// fix the 46 minute limit error	
			fileid = fileid.substr(0, 2) + '0' + fileid.substr(3);
			

			var EpSidToken = GenerateNewEp(fileid, ep)
			var flvjson = {
				// ts: Math.floor(Date.now() / 1000),
				ctype: 12,
				ep: EpSidToken[0],
				ev: 1,
				keyframe: 1,
				oip: metadata0.ip,
				sid: EpSidToken[1]+"_01",
				token: EpSidToken[2],
				type: "mp4",
				vid: vid,
				k: metadata0.segs["mp4"][0].k,
				ts: metadata0.segs["mp4"][0].seconds,
				fileid: fileid
			}
			var flvquery = "http://k.youku.com/player/getFlvPath/sid/"+ flvjson.sid
						  +"/st/mp4/fileid/"+ flvjson.fileid
						  +"?K="+ flvjson.k
						  +"&hd=0&ymovie=1&myp=0&ts="+flvjson.ts
						  +"&ypp=2&ctype=12&ev=1&"
						  +"token="+ flvjson.token
						  +"&oip="+ flvjson.oip
						  +"&ep="+ flvjson.ep
			
			callback(flvquery)
			
		}

	})
}




app.get('/',function(req, res){
	if(req.query.id){
		GenerateMp4Query(req.query.id, function(uri){
			if(uri === 'error') return res.send("Error")
			res.redirect(uri)
		})			
	}

	else return res.send("Error")
})

app.get('/raw',function(req, res){
	if(req.query.id){
		GenerateMp4Query(req.query.id, function(uri){
			if(uri === 'error') return res.send("Error")
			res.send(uri)
		})			
	}

	else return res.send("Error")
})

app.get('/fetch/sohu/:vid', function(req, res){
	var vid = req.params.vid;
	sohu(vid, function(err, url){
		if(err) return res.json({success: false, err: err})
		res.json({success: true, url: url});
	})
})

app.get('/fetch/sohu/play/:vid', function(req, res){
	var vid = req.params.vid;
	sohu(vid, function(err, url){
		if(err) return res.send("Error.")
		res.redirect(url);
	})
})

// console.log(new Buffer("MgXRRgkZIbPa2fbA/OJxBtP8vxQ11wnIXB8=", 'base64').toString('binary'))

// console.log(core.yk_e("becaf9be",new Buffer("MgXRRgkZIbPa2fbA/OJxBtP8vxQ11wnIXB8=", 'base64').toString('binary')))

app.listen(8083);



	