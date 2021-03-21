
// https://stackoverflow.com/questions/24004791/can-someone-explain-the-debounce-function-in-javascript
function debounce(func, wait, immediate) {
	var timeout
	return function() {
		var context = this
		var args = arguments
		var later = function() {
			timeout = null
			if (!immediate) {
				func.apply(context, args)
			}
		}
		var callNow = immediate && !timeout
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
		if (callNow) {
			func.apply(context, args)
		}
	}
}

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

function generatePlaceList(placeList, bookmarks) {
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
}

function generateGroup(listId, listName, bookmarks) {
	for (bookmark of bookmarks) {
		console.log(bookmark.url, bookmark)
	}

	var kanban = document.querySelector('#kanban')

	var group = document.createElement('div')
	group.classList.add('kanban-group')
	group.setAttribute('data-id', listId)
	kanban.appendChild(group)

	var heading = document.createElement('h3')
	heading.textContent = listName
	group.appendChild(heading)

	var placeList = document.createElement('div')
	placeList.classList.add('place-list')
	group.appendChild(placeList)

	generatePlaceList(placeList, bookmarks)
}

function generateFolderGroup(folderTitle) {
	browser.bookmarks.search({
		title: folderTitle,
	}).then(function(searchResults){
		var folderBookmark = searchResults[0]
		console.log('folderBookmark', folderBookmark)
		var genListFunc = generateGroup.bind(this, folderBookmark.id, folderBookmark.title)
		browser.bookmarks.getChildren(folderBookmark.id).then(function(bookmarks){
			return bookmarks.reverse()
		}).then(genListFunc)
	})
}

function generateRecentGroup() {
	var numBookmarks = 4 * 8
	browser.bookmarks.getRecent(numBookmarks).then(function(bookmarks){
		generateGroup('recent', 'Recent', bookmarks)
	})
}

function updateSearchGroup(bookmarks) {
	var kanban = document.querySelector('#kanban')
	var group = getGroup('search')
	if (bookmarks.length >= 1) {
		kanban.classList.add('searching')
	} else {
		kanban.classList.remove('searching')
	}
	var placeList = group.querySelector('.place-list')
	placeList.innerHTML = '' // Clear
	generatePlaceList(placeList, bookmarks)
}

function generateSearchGroup() {
	generateGroup('search', 'Search', [])
	updateSearchGroup([])
}

function getGroup(listId) {
	return document.querySelector('.kanban-group[data-id="' + listId + '"]')
}

function doSearch() {
	var query = document.querySelector('input#query').value
	if (query) {
		browser.bookmarks.search({
			query: query,
		}).then(updateSearchGroup)
	} else {
		updateSearchGroup([])
	}
}
var debouncedDoSearch = debounce(doSearch, 600)

function onQueryChange() {
	var query = document.querySelector('input#query').value
	if (query) {
		debouncedDoSearch()
	} else {
		// Immediately clear search
		doSearch()
	}
}

function init() {
	generateSearchGroup()
	generateRecentGroup()
	generateFolderGroup('Streams')
	generateFolderGroup('Sleep')
	generateFolderGroup('Shows')
	generateFolderGroup('Ani')
	generateFolderGroup('Comics')

	document.querySelector('input#query').addEventListener('change', onQueryChange)
	document.querySelector('input#query').addEventListener('keydown', onQueryChange)
}

init()
