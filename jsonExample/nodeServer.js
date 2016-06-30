var http = require('http');
const PORT = 8080;
var url = require('url');
var fs = require('fs');
var obj = JSON.parse(fs.readFileSync('pokemons.json', 'utf8'));

function handleRequest(request, response) {
	console.info('-----REQUEST------');
	console.info(request.method + ' ' + request.url);
	var url_parts = url.parse(request.url, true);
	var textToSearch = url_parts.query.text;
	if (request.method == 'POST') {
		var result = [];
		for (var i = 0; i < obj.length;i++) {
			if (obj[i].indexOf(textToSearch) > -1) {
				result.push(obj[i]);
			}
		}
		var resultStr = JSON.stringify(result);
		console.info(resultStr);
		response.end(JSON.stringify(result));
	} else {
		obj.push(textToSearch);
	}
}

var server = http.createServer(handleRequest);
server.listen(PORT, function () {
	console.log("Server listening on: http://localhost:%s", PORT);
});
