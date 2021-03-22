var isFirefox = typeof browser !== 'undefined'
var browserAPI = chrome

function cacheFavicon(hostname, favIconUrl) {
	browserAPI.storage.local.get({
		'favIconHostList': [],
	}, function(items) {
		if (items.favIconHostList.indexOf(hostname) == -1) {
			var values = {}

			var newHostList = items.favIconHostList.slice()
			newHostList.push(hostname)
			values['favIconHostList'] = newHostList

			var hostnameKey = 'favIconUrl-' + hostname
			values[hostnameKey] = favIconUrl

			console.log('cacheFavicon', hostnameKey, favIconUrl)
			browserAPI.storage.local.set(values)
		}
	})
}

function onTabUpdated(tabId, changeInfo, tabInfo) {
	if (changeInfo.favIconUrl) {
		// console.log("Tab: " + tabId + " URL changed to " + changeInfo.url)
		// console.log("    favIconUrl:", tabInfo.favIconUrl)
		// console.log("    changeInfo:", changeInfo)
		// console.log("    tabInfo:", tabInfo)

		var a = document.createElement('a')
		a.href = tabInfo.url

		cacheFavicon(a.hostname, changeInfo.favIconUrl)
	}
}


if (isFirefox) {
	var tabUpdateFilter = {
		properties: [
			'favIconUrl'
		],
	}
	browserAPI.tabs.onUpdated.addListener(onTabUpdated, tabUpdateFilter)
}
