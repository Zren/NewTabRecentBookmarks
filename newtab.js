var cache = {
	pinnedFolders: [],
}

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
		var entry
		if (bookmark.type == 'bookmark') {
			entry = document.createElement('a')
			entry.setAttribute('href', bookmark.url)
			entry.setAttribute('title', bookmark.title + (bookmark.url ? '\n' + bookmark.url : ''))
		} else if (bookmark.type == 'folder') {
			entry = document.createElement('div')
			entry.setAttribute('container', 'true')
		}
		entry.setAttribute('data-id', bookmark.id)
		entry.classList.add('place-entry')

		var icon = document.createElement('span')
		icon.classList.add('icon')
		icon.classList.add('place-icon')
		if (bookmark.type == 'bookmark') {
			var iconBgColor = hslFromHostname(entry.hostname)
			icon.style.backgroundColor = iconBgColor
		}
		entry.appendChild(icon)

		var label = document.createElement('span')
		label.classList.add('place-label')
		label.textContent = bookmark.title
		entry.appendChild(label)

		if (bookmark.type == 'folder') {
			var isPinned = cache.pinnedFolders.indexOf(bookmark.id) >= 0
			var pinButton = document.createElement('button')
			pinButton.classList.add('icon')
			pinButton.classList.add('toggle-pin')
			if (isPinned) {
				pinButton.classList.add('pinned')
			}
			pinButton.addEventListener('click', function(){
				var entry = this.parentNode
				var bookmarkId = entry.getAttribute('data-id')
				this.classList.toggle('pinned')
				if (bookmarkId) {
					togglePinnedFolder(bookmarkId)
				}
			})
			entry.appendChild(pinButton)
		}

		placeList.appendChild(entry)
	}
}

function generateGroup(listId, listName, bookmarks) {
	// for (bookmark of bookmarks) {
	// 	console.log(bookmark.url, bookmark)
	// }

	var kanban = document.querySelector('#kanban')

	var group = document.createElement('div')
	group.classList.add('kanban-group')
	group.setAttribute('data-id', listId)
	kanban.appendChild(group)

	var heading = document.createElement('div')
	heading.classList.add('kanban-group-heading')

	var headingLabel = document.createElement('h3')
	headingLabel.classList.add('kanban-group-label')
	headingLabel.textContent = listName
	heading.appendChild(headingLabel)

	if (listId != 'search' && listId != 'recent') {
		var pinButton = document.createElement('button')
		pinButton.classList.add('icon')
		pinButton.classList.add('toggle-pin')
		pinButton.classList.add('pinned')
		pinButton.addEventListener('click', function(){
			var group = this.parentNode.parentNode
			var bookmarkId = group.getAttribute('data-id')
			if (bookmarkId) {
				togglePinnedFolder(bookmarkId)
			}
		})
		heading.appendChild(pinButton)
	}

	group.appendChild(heading)

	var placeList = document.createElement('div')
	placeList.classList.add('place-list')
	group.appendChild(placeList)

	generatePlaceList(placeList, bookmarks)
}

function generateFolderGroup(folderId) {
	browser.bookmarks.get(folderId).then(function(getBookmarks){
		var folderBookmark = getBookmarks[0]
		// console.log('folderBookmark', folderBookmark)
		var genListFunc = generateGroup.bind(this, folderBookmark.id, folderBookmark.title)
		browser.bookmarks.getChildren(folderBookmark.id).then(function(bookmarks){
			return bookmarks.reverse()
		}).then(genListFunc)
	})
}

function generateRecentGroup() {
	var numBookmarks = 36 // 4 * 8
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

function clearFolderGroups() {
	var selector = '.kanban-group:not([data-id="search"]):not([data-id="recent"])'
	document.querySelectorAll(selector).forEach(function(group){
		group.remove()
	})
}

function generatePinnedFolderGroups() {
	browser.storage.local.get('pinnedFolders').then(function(items){
		// console.log('onGet', items.pinnedFolders)
		cache.pinnedFolders = items.pinnedFolders
		for (var folderId of items.pinnedFolders) {
			generateFolderGroup(folderId)
		}
	})
}

function updatePinnedFolderGroups() {
	clearFolderGroups()
	generatePinnedFolderGroups()
}

function onStorageChange(changes, area) {
	// console.log('onStorageChange', changes, area)
	if (typeof changes.pinnedFolders !== 'undefined') {
		updatePinnedFolderGroups()
	}
}

function loadConfig() {
	updatePinnedFolderGroups()
}

function setPinnedFolders(pinnedFolders) {
	browser.storage.local.set({
		pinnedFolders: pinnedFolders,
	}).then(function(items){
		console.log('onSet', items.pinnedFolders.oldValue, items.pinnedFolders.newValue)
		// updatePinnedFolderGroups()
	})
}

function addPinnedFolder(folderId) {
	var wasPinned = cache.pinnedFolders.indexOf(folderId) >= 0
	if (!wasPinned) {
		cache.pinnedFolders.push(folderId)
		setPinnedFolders(cache.pinnedFolders)
	}
}
function removePinnedFolder(folderId) {
	var index = cache.pinnedFolders.indexOf(folderId)
	var wasPinned = index >= 0
	if (wasPinned) {
		cache.pinnedFolders.splice(index, 1) // Remove
		setPinnedFolders(cache.pinnedFolders)
	}
}
function togglePinnedFolder(folderId) {
	var wasPinned = cache.pinnedFolders.indexOf(folderId) >= 0
	console.log('togglePinnedFolder', folderId, 'wasPinned', wasPinned)
	if (wasPinned) {
		removePinnedFolder(folderId)
	} else {
		addPinnedFolder(folderId)
	}
}

function init() {
	generateSearchGroup()
	generateRecentGroup()

	browser.storage.onChanged.addListener(onStorageChange)
	document.addEventListener("DOMContentLoaded", loadConfig)
	document.querySelector('input#query').addEventListener('change', onQueryChange)
	document.querySelector('input#query').addEventListener('keydown', onQueryChange)
}

init()
