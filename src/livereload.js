
var watchCache = {}

function watchFile(filepath) {
	function checkFile() {
		fetch(filepath).then(function(res){
			return res.text()
		}).then(function(text){
			var oldValue = watchCache[filepath]
			if (typeof oldValue === 'undefined') {
				watchCache[filepath] = text
			} else if (oldValue != text) {
				document.location.reload()
			}
		})
	}

	setInterval(checkFile, 500)
}

watchFile('newtab.js')
watchFile('newtab.css')
