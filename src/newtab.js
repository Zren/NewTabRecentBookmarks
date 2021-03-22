// Firefox doesn't support favicon urls (https://bugzilla.mozilla.org/show_bug.cgi?id=1315616)
// Firefox does support favicon urls (chrome://favicon).
// Chrome doesn't return promises, and requires a callback parameter.
// Chrome also doesn't support 'bookmark.type'
var browserAPI = chrome
var isFirefox = typeof browser !== 'undefined'
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

function onEntryTogglePinClicked() {
	var entry = this.parentNode
	var folderId = entry.getAttribute('data-id')
	this.classList.toggle('pinned')
	if (folderId) {
		togglePinnedFolder(folderId)
	}
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
				icon.setAttribute('data-hostname', entry.hostname)
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
			pinButton.addEventListener('click', onEntryTogglePinClicked)
			entry.appendChild(pinButton)
		}

		placeList.appendChild(entry)
	}
}

function movePinnedFolderByDelta(bookmarkId, delta) {
	var bookmarkIndex = cache.pinnedFolders.indexOf(bookmarkId)
	if (bookmarkIndex == -1) {
		throw Exception('Could not find pinnedFolder in cache', bookmarkId, cache.pinnedFolders)
	} else {
		var newIndex = Math.max(0, Math.min(bookmarkIndex + delta, cache.pinnedFolders.length - 1))
		if (newIndex != bookmarkIndex) {
			var newPinnedFolders = cache.pinnedFolders.slice()
			newPinnedFolders.splice(bookmarkIndex, 1) // Remove at old index
			newPinnedFolders.splice(newIndex, 0, bookmarkId) // Insert at new index
			setPinnedFolders(newPinnedFolders)
		}
	}
}

function onGroupMoveLeftClicked() {
	var groupDiv = this.parentNode.parentNode
	var bookmarkId = groupDiv.getAttribute('data-id')
	if (bookmarkId) {
		movePinnedFolderByDelta(bookmarkId, -1)
	}
}

function onGroupMoveRightClicked() {
	var groupDiv = this.parentNode.parentNode
	var bookmarkId = groupDiv.getAttribute('data-id')
	if (bookmarkId) {
		movePinnedFolderByDelta(bookmarkId, 1)
	}
}

function onGroupTogglePinClicked() {
	var groupDiv = this.parentNode.parentNode
	var folderId = groupDiv.getAttribute('data-id')
	if (folderId) {
		togglePinnedFolder(folderId)
	}
}

function generateGroupHeading(group) {
	var heading = document.createElement('div')
	heading.classList.add('kanban-group-heading')

	var headingLabel = document.createElement('h3')
	headingLabel.classList.add('kanban-group-label')
	headingLabel.textContent = group.title
	heading.appendChild(headingLabel)

	if (group.id != 'search' && group.id != 'recent') {
		var moveLeftButton = document.createElement('button')
		moveLeftButton.classList.add('icon')
		moveLeftButton.classList.add('group-move-left')
		moveLeftButton.addEventListener('click', onGroupMoveLeftClicked)
		heading.appendChild(moveLeftButton)

		var moveRightButton = document.createElement('button')
		moveRightButton.classList.add('icon')
		moveRightButton.classList.add('group-move-right')
		moveRightButton.addEventListener('click', onGroupMoveRightClicked)
		heading.appendChild(moveRightButton)

		var pinButton = document.createElement('button')
		pinButton.classList.add('icon')
		pinButton.classList.add('toggle-pin')
		pinButton.classList.add('pinned')
		pinButton.addEventListener('click', onGroupTogglePinClicked)
		heading.appendChild(pinButton)
	}

	return heading
}

// A group uses the same struct as a bookmark
// group = { id: '', title: '' }
function generateGroup(group, bookmarks) {
	// for (bookmark of bookmarks) {
	// 	console.log(bookmark.url, bookmark)
	// }

	var kanban = document.querySelector('#kanban')

	var groupDiv = document.createElement('div')
	groupDiv.classList.add('kanban-group')
	groupDiv.setAttribute('data-id', group.id)
	kanban.appendChild(groupDiv)

	var heading = generateGroupHeading(group)
	groupDiv.appendChild(heading)

	var placeList = document.createElement('div')
	placeList.classList.add('place-list')
	groupDiv.appendChild(placeList)

	generatePlaceList(placeList, bookmarks)
}

function generateFolderGroup(folderBookmark, callback, bookmarks) {
	bookmarks.reverse()
	generateGroup(folderBookmark, bookmarks)
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
		generateGroup({
			id: 'recent',
			title: 'Recent'
		}, bookmarks)
	})
}

function updateSearchGroup(bookmarks) {
	var kanban = document.querySelector('#kanban')
	var groupDiv = getGroup('search')
	if (bookmarks.length >= 1) {
		kanban.classList.add('searching')
	} else {
		kanban.classList.remove('searching')
	}
	var placeList = groupDiv.querySelector('.place-list')
	placeList.innerHTML = '' // Clear
	generatePlaceList(placeList, bookmarks)
}

function generateSearchGroup() {
	generateGroup({
		id: 'search',
		title: 'Search'
	}, [])
	updateSearchGroup([])
}

function getGroup(groupId) {
	return document.querySelector('.kanban-group[data-id="' + groupId + '"]')
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
	document.querySelectorAll(selector).forEach(function(groupDiv){
		groupDiv.remove()
	})
}

function fetchFavicons(callback) {
	var hostnameList = document.querySelectorAll('.place-icon[data-hostname]')
	hostnameList = Array.prototype.map.call(hostnameList, function(placeIcon) {
		return placeIcon.getAttribute('data-hostname')
	})
	var keys = {}
	for (var hostname of hostnameList) {
		var hostnameKey = 'favIconUrl-' + hostname
		keys[hostnameKey] = ''
	}
	browserAPI.storage.local.get(keys, function(items){
		var keys = Object.keys(items)
		// console.log('fetchFavicons', keys)

		var style = document.createElement('style')
		style.setAttribute('type', 'text/css')
		style.setAttribute('id', 'favicon-style')
		document.head.appendChild(style) // Must add to DOM before sheet property is available
		var stylesheet = style.sheet
		for (var key of keys) {
			var hostname = key.substr('favIconUrl-'.length)
			var favIconUrl = items[key]
			if (favIconUrl) {
				var selector = '.place-icon[data-hostname="' + hostname + '"]'
				var rule = selector + ' { background-image: url(' + favIconUrl + '); background-color: none !important; }'
				stylesheet.insertRule(rule, stylesheet.cssRules.length)
				document.querySelectorAll(selector).forEach(function(placeIcon){
					placeIcon.style.backgroundColor = ''
				})
			}
		}
		callback()
	})
}

function doneLoading() {
	if (!pageLoaded) {
		requestAnimationFrame(function(){
			var kanban = document.querySelector('#kanban')
			kanban.removeAttribute('loading')
			pageLoaded = true

			fetchFavicons(function(){
				// console.log('fetchFavicons done')
			})
		})
	}
}

function generatePinnedFolderGroups() {
	browserAPI.storage.local.get({
		'pinnedFolders': [],
	}, function(items){
		// console.log('onGet', items.pinnedFolders)
		cache.pinnedFolders = items.pinnedFolders
		if (items.pinnedFolders.length == 0) {
			doneLoading()
		} else {
			generateFolderGroupList(items.pinnedFolders, function(){
				doneLoading()
			})
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

function bindSearchInput() {
	var query = document.querySelector('input#query')
	query.addEventListener('change', onQueryChange)
	query.addEventListener('keydown', onQueryChange)

	// Required for Chrome's clear button
	// https://stackoverflow.com/questions/2977023/how-do-you-detect-the-clearing-of-a-search-html5-input
	query.addEventListener('search', onQueryChange)
}

function init() {
	generateSearchGroup()
	generateRecentGroup()
	loadConfig()

	browserAPI.storage.onChanged.addListener(onStorageChange)
	bindSearchInput()
}

document.addEventListener("DOMContentLoaded", init)

