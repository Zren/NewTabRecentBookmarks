
function hslFromHostname(urlHostname) {
	var hostname = urlHostname.replace(/^www\./, '')
	var aCode = 'a'.charCodeAt(0)
	var zCode = 'z'.charCodeAt(0)
	var hueRatio = (hostname.toLowerCase().charCodeAt(0) - aCode) / (zCode - aCode)
	var hue = Math.round(255 * hueRatio)
	var satRatio = (hostname.toLowerCase().charCodeAt(1) - aCode) / (zCode - aCode)
	var sat = 60 + Math.round(40 * satRatio)
	var ligRatio = (hostname.toLowerCase().charCodeAt(2) - aCode) / (zCode - aCode)
	var lig = 10 + Math.round(30 * satRatio)
	return 'hsl(' + hue + ', ' + sat + '%, ' + lig + '%)'
}

function generateList(listName, fetchBookmarksPromise) {
	fetchBookmarksPromise.then(function onFulfilled(bookmarks) {
		for (bookmark of bookmarks) {
			console.log(bookmark.url, bookmark)
		}


		var kanban = document.querySelector('#kanban')

		var group = document.createElement('div')
		group.classList.add('kanban-group')
		kanban.appendChild(group)

		var heading = document.createElement('h3')
		heading.textContent = listName
		group.appendChild(heading)

		var placeList = document.createElement('div')
		placeList.classList.add('place-list')
		group.appendChild(placeList)

		for (bookmark of bookmarks) {
			var entry = document.createElement('a')
			entry.classList.add('place-entry')
			if (bookmark.url) {
				entry.setAttribute('href', bookmark.url)
			}
			entry.setAttribute('title', bookmark.title + (bookmark.url ? '\n' + bookmark.url : ''))

			var icon = document.createElement('span')
			icon.classList.add('place-icon')
			if (bookmark.type == 'bookmark') {
				var iconBgColor = hslFromHostname(entry.hostname)
				icon.style.backgroundColor = iconBgColor
			} else if (bookmark.type == 'folder') {
				icon.setAttribute('container', 'true')
			}
			entry.appendChild(icon)

			var label = document.createElement('span')
			label.classList.add('place-label')
			label.textContent = bookmark.title
			entry.appendChild(label)

			placeList.appendChild(entry)
		}

	})
}

function generateFolderList(folderTitle) {
	browser.bookmarks.search({
		title: folderTitle,
	}).then(function(searchResults){
		var folderBookmark = searchResults[0]
		console.log('folderBookmark', folderBookmark)
		var folderBookmarksPromise = browser.bookmarks.getChildren(folderBookmark.id).then(function(bookmarks){
			return bookmarks.reverse()
		})
		generateList(folderBookmark.title, folderBookmarksPromise)
	})
}

generateList('Recent', browser.bookmarks.getRecent(4*8))
generateFolderList('Streams')
generateFolderList('Sleep')
generateFolderList('Shows')
generateFolderList('Ani')
generateFolderList('Comics')
