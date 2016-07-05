var http = require('http');
const PORT = 8080;
var url = require('url');
var fs = require('fs');
var obj = JSON.parse(fs.readFileSync('pokemons.json', 'utf8'));

function handleRequest(request, response) {
	console.info('-----REQUEST------');
	console.info(request.method + ' ' + request.url);
	if (request.url == '/' && request.method == 'GET') {
		response.end(fs.readFileSync('../index.html', 'utf8'));
		return;
	}
	if (request.url.indexOf('.') > -1 && request.method == 'GET') {
		try {
			var file = fs.readFileSync('..' + request.url, 'utf8');
			response.end(file);
		} catch(e) {
			response.end('');
		}
		return;
	}
	var url_parts = url.parse(request.url, true);
	var textToSearch = url_parts.query.text;
	var limit = url_parts.query.limit;
	if (request.method == 'GET') {
		var result = [];
		for (var i = 0; i < obj.length && result.length < limit; i++) {
			if (obj[i].name.indexOf(textToSearch) > -1) {
				result.push(obj[i]);
			}
		}
		var resultStr = JSON.stringify(result);
		console.info(resultStr);
		response.end(JSON.stringify(result));
	} else {
		var body;
		request.on('data', function (chunk) {
    body += chunk;
  });
  request.on('end', function () {

		textToSearch = request.params;
		var maxId = 0;
		for (var i =0; i<obj.length;i++) {
			if (maxId < obj[i].id) {
				maxId = obj[i].id;
			}
		}
		obj.push({
			id: maxId + 1,
			name: body.split('=')[1]
		});
		response.end('ok');
	});
	}
}

var server = http.createServer(handleRequest);
server.listen(PORT, function () {
	console.log("Server listening on: http://localhost:%s", PORT);
});
