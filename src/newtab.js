// Firefox doesn't support favicon urls (https://bugzilla.mozilla.org/show_bug.cgi?id=1315616)
// Firefox does support favicon urls (chrome://favicon).
// Chrome doesn't return promises, and requires a callback parameter.
// Chrome also doesn't support 'bookmark.type'
var browserAPI = chrome
var isChrome = typeof browser === 'undefined'

var pageLoaded = false
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
		// console.log('generatePlaceList', bookmark)
		// Chrome does not set bookmark.type
		var isBookmark = (typeof bookmark.type !== 'undefined'
			? bookmark.type === 'bookmark' // Firefox
			: typeof bookmark.dateGroupModified === 'undefined' // Chrome
		)
		var isFolder = (typeof bookmark.type !== 'undefined'
			? bookmark.type === 'folder' // Firefox
			: typeof bookmark.dateGroupModified !== 'undefined' // Chrome
		)

		var entry
		if (isBookmark) {
			entry = document.createElement('a')
			entry.setAttribute('href', bookmark.url)
			entry.setAttribute('title', bookmark.title + (bookmark.url ? '\n' + bookmark.url : ''))
		} else if (isFolder) {
			entry = document.createElement('div')
			entry.setAttribute('container', 'true')
		} else {
			continue
		}
		entry.setAttribute('data-id', bookmark.id)
		entry.classList.add('place-entry')

		var icon = document.createElement('span')
		icon.classList.add('icon')
		icon.classList.add('place-icon')
		if (isBookmark) {
			if (isChrome) {
				icon.style.backgroundImage = 'url(chrome://favicon/' + encodeURI(bookmark.url) + ')'
			} else {
				var iconBgColor = hslFromHostname(entry.hostname)
				icon.style.backgroundColor = iconBgColor
			}
		}
		entry.appendChild(icon)

		var label = document.createElement('span')
		label.classList.add('place-label')
		label.textContent = bookmark.title
		entry.appendChild(label)

		if (isFolder) {
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

function generateFolderGroup(folderBookmark, callback, bookmarks) {
	bookmarks.reverse()
	generateGroup(folderBookmark.id, folderBookmark.title, bookmarks)
	callback()
}

function generateFolderGroupList(folderIdList, callback) {
	browserAPI.bookmarks.get(folderIdList, function(folderBookmarkList){
		var groupsDone = 0
		function onGroupDone() {
			groupsDone += 1
			// console.log('onGroupDone', groupsDone, '/', folderIdList.length)
			if (groupsDone >= folderIdList.length) {
				callback()
			}
		}
		var promiseList = []
		for (var folderBookmark of folderBookmarkList) {
			// console.log('folderBookmark', folderBookmark)
			var genListFunc = generateFolderGroup.bind(this, folderBookmark, onGroupDone)
			browserAPI.bookmarks.getChildren(folderBookmark.id, genListFunc)
		}
	})
}

function generateRecentGroup() {
	var numBookmarks = 36 // 4 * 8
	browserAPI.bookmarks.getRecent(numBookmarks, function(bookmarks){
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
		browserAPI.bookmarks.search({
			query: query,
		}, updateSearchGroup)
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
	browserAPI.storage.local.get({
		'pinnedFolders': [],
	}, function(items){
		// console.log('onGet', items.pinnedFolders)
		cache.pinnedFolders = items.pinnedFolders
		generateFolderGroupList(items.pinnedFolders, function(){
			if (!pageLoaded) {
				requestAnimationFrame(function(){
					var kanban = document.querySelector('#kanban')
					kanban.removeAttribute('loading')
					pageLoaded = true
				})
			}
		})
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
	browserAPI.storage.local.set({
		pinnedFolders: pinnedFolders,
	}, function(items){
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
	// console.log('togglePinnedFolder', folderId, 'wasPinned', wasPinned)
	if (wasPinned) {
		removePinnedFolder(folderId)
	} else {
		addPinnedFolder(folderId)
	}
}

function init() {
	generateSearchGroup()
	generateRecentGroup()
	loadConfig()

	browserAPI.storage.onChanged.addListener(onStorageChange)
	document.querySelector('input#query').addEventListener('change', onQueryChange)
	document.querySelector('input#query').addEventListener('keydown', onQueryChange)
}

document.addEventListener("DOMContentLoaded", init)

