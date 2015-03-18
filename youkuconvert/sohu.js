var request = require('request');
var vurl = "http://newflv.sohu.ccgslb.net/"
var vurl_temp ="http://sohu.vodnew.lxdns.com/"

module.exports = function(vid, callback){
	var apiurl = "http://api.tv.sohu.com/v4/video/info/"+vid+".json?site=1&%20plat=6&poid=1&api_key=9854b2afa779e1a6bff1962447a09dbd"
	request.get(apiurl, function(err, httpResponse, body){
		metadata = JSON.parse(body);
		if(metadata.status == 200 && metadata.data.download_url){
			durl = metadata.data.download_url;
			var routename = durl.match('new=\/(.+.mp4)')[1];
			furl = vurl+routename

			callback(null, furl)
		}
		else{
			callback("error")
		}
	})
}