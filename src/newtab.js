// Firefox doesn't support favicon urls (https://bugzilla.mozilla.org/show_bug.cgi?id=1315616)
// Chrome does support favicon urls (chrome://favicon).
// Chrome doesn't return promises, and requires a callback parameter.
// Chrome also doesn't support 'bookmark.type'
var browserAPI = chrome
var isFirefox = typeof browser !== 'undefined'
var isChrome = typeof browser === 'undefined'

var pageLoaded = false
var cache = {
	pinnedFolders: [],
	faviconHostnameList: [],
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

function onEntryEditPlaceClicked() {
	var entry = this.closest('.place-entry')
	var bookmarkId = entry.getAttribute('data-id')
	if (bookmarkId) {
		showEditBookmarkForm(bookmarkId)
	}
}

function onEntryTogglePinClicked() {
	var entry = this.closest('.place-entry')
	var folderId = entry.getAttribute('data-id')
	this.classList.toggle('pinned')
	if (folderId) {
		togglePinnedFolder(folderId)
	}
}

function canModifyGroup(groupId) {
	return groupId != 'search' && groupId != 'recent'
}

function generatePlaceEntry(bookmark) {
	// Chrome does not set bookmark.type
	var isBookmark = (typeof bookmark.type !== 'undefined'
		? bookmark.type === 'bookmark' // Firefox
		: typeof bookmark.dateGroupModified === 'undefined' // Chrome
	)
	var isFolder = (typeof bookmark.type !== 'undefined'
		? bookmark.type === 'folder' // Firefox
		: typeof bookmark.dateGroupModified !== 'undefined' // Chrome
	)

	var entry = document.createElement('div')
	entry.setAttribute('data-id', bookmark.id)
	entry.classList.add('place-entry')

	var entryLink = document.createElement('a')
	entryLink.classList.add('place-link')
	entry.appendChild(entryLink)

	if (isBookmark) {
		entryLink.setAttribute('href', bookmark.url)
		entryLink.setAttribute('title', bookmark.title + (bookmark.url ? '\n' + bookmark.url : ''))
	} else if (isFolder) {
		entry.setAttribute('container', 'true')
		entryLink.setAttribute('title', bookmark.title)
	} else {
		return null
	}

	var icon = document.createElement('span')
	icon.className = 'place-icon icon'
	if (isBookmark) {
		icon.classList.add('icon-bookmark-overlay')
		if (isChrome) {
			icon.style.backgroundImage = 'url(chrome://favicon/' + encodeURI(bookmark.url) + ')'
		} else {
			var iconBgColor = hslFromHostname(entryLink.hostname)
			icon.style.backgroundColor = iconBgColor
			icon.setAttribute('data-hostname', entryLink.hostname)
		}
	}
	entryLink.appendChild(icon)

	var label = document.createElement('span')
	label.classList.add('place-label')
	label.textContent = bookmark.title
	entryLink.appendChild(label)

	if (isBookmark) {
		var editPlaceButton = document.createElement('button')
		editPlaceButton.className = 'edit-place-button icon icon-edit'
		editPlaceButton.addEventListener('click', onEntryEditPlaceClicked)
		entry.appendChild(editPlaceButton)
	} else if (isFolder) {
		var isPinned = cache.pinnedFolders.indexOf(bookmark.id) >= 0
		var pinButton = document.createElement('button')
		pinButton.className = 'group-toggle-pin icon icon-pin'
		if (isPinned) {
			pinButton.classList.add('pinned')
		}
		pinButton.addEventListener('click', onEntryTogglePinClicked)
		entry.appendChild(pinButton)
	}

	return entry
}

function generatePlaceList(placeList, bookmarks) {
	for (bookmark of bookmarks) {
		// console.log('generatePlaceList', bookmark)
		var entry = generatePlaceEntry(bookmark)
		if (!entry) {
			continue
		}
		placeList.appendChild(entry)
	}
}

function movePinnedFolder(bookmarkId, bookmarkIndex, _newIndex) {
	var newIndex = Math.max(0, Math.min(_newIndex, cache.pinnedFolders.length - 1))
	if (newIndex != bookmarkIndex) {
		var newPinnedFolders = cache.pinnedFolders.slice()
		newPinnedFolders.splice(bookmarkIndex, 1) // Remove at old index
		newPinnedFolders.splice(newIndex, 0, bookmarkId) // Insert at new index
		setPinnedFolders(newPinnedFolders)
	}
}
function movePinnedFolderByDelta(bookmarkId, delta) {
	var bookmarkIndex = cache.pinnedFolders.indexOf(bookmarkId)
	if (bookmarkIndex == -1) {
		throw Exception('Could not find pinnedFolder in cache', bookmarkId, cache.pinnedFolders)
	}
	var newIndex = bookmarkIndex + delta
	movePinnedFolder(bookmarkId, bookmarkIndex, newIndex)
}

function insertBeforePinnedFolder(bookmarkId, targetBookmarkId) {
	var bookmarkIndex = cache.pinnedFolders.indexOf(bookmarkId)
	if (bookmarkIndex == -1) {
		throw Exception('Could not find pinnedFolder in cache', bookmarkId, cache.pinnedFolders)
	}
	var targetBookmarkIndex = cache.pinnedFolders.indexOf(targetBookmarkId)
	if (targetBookmarkIndex == -1) {
		throw Exception('Could not find pinnedFolder in cache', targetBookmarkIndex, cache.pinnedFolders)
	}
	var newIndex = targetBookmarkIndex
	if (bookmarkIndex < newIndex) {
		// We remove the bookmark first, which shifts the insertion index.
		newIndex -= 1
	}
	movePinnedFolder(bookmarkId, bookmarkIndex, newIndex)
}

function onGroupMoveLeftClicked() {
	var groupDiv = this.closest('.kanban-group')
	var folderId = groupDiv.getAttribute('data-id')
	if (folderId) {
		movePinnedFolderByDelta(folderId, -1)
	}
}

function onGroupMoveRightClicked() {
	var groupDiv = this.closest('.kanban-group')
	var folderId = groupDiv.getAttribute('data-id')
	if (folderId) {
		movePinnedFolderByDelta(folderId, 1)
	}
}

function onGroupTogglePinClicked() {
	var groupDiv = this.closest('.kanban-group')
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
	if (canModifyGroup(group.id)) {
		headingLabel.setAttribute('draggable', 'true')
	}
	heading.appendChild(headingLabel)

	if (canModifyGroup(group.id)) {
		var moveLeftButton = document.createElement('button')
		moveLeftButton.className = 'group-move-left icon icon-previous'
		moveLeftButton.addEventListener('click', onGroupMoveLeftClicked)
		heading.appendChild(moveLeftButton)

		var moveRightButton = document.createElement('button')
		moveRightButton.className = 'group-move-right icon icon-next'
		moveRightButton.addEventListener('click', onGroupMoveRightClicked)
		heading.appendChild(moveRightButton)

		var pinButton = document.createElement('button')
		pinButton.className = 'group-toggle-pin icon icon-pin pinned'
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

	fetchFavicons(function(){
		// console.log('fetchFavicons done')
	})
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

// https://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
function clearChildrenOf(parent) {
	while (parent.firstChild) { 
		parent.removeChild(parent.lastChild)
	}
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
	clearChildrenOf(placeList)
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
	var query = document.querySelector('input#newtab-search-text').value
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
	var query = document.querySelector('input#newtab-search-text').value
	if (query) {
		debouncedDoSearch()
	} else {
		// Immediately clear search
		doSearch()
	}
}

function clearAllGroups() {
	var selector = '.kanban-group'
	document.querySelectorAll(selector).forEach(function(groupDiv){
		groupDiv.remove()
	})
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
		if (!cache.faviconHostnameList.includes(hostname)) {
			var hostnameKey = 'favIconUrl-' + hostname
			keys[hostnameKey] = ''
			cache.faviconHostnameList.push(hostname)
		}
	}
	browserAPI.storage.local.get(keys, function(items){
		var keys = Object.keys(items)
		// console.log('fetchFavicons', keys)

		var style = document.querySelector('style#favicon-style')
		if (!style) {
			style = document.createElement('style')
			style.setAttribute('type', 'text/css')
			style.setAttribute('id', 'favicon-style')
			document.head.appendChild(style) // Must add to DOM before sheet property is available
		}
		var stylesheet = style.sheet
		for (var key of keys) {
			var hostname = key.substr('favIconUrl-'.length)
			var favIconUrl = items[key]
			if (favIconUrl) {
				var selector = '.place-icon[data-hostname="' + hostname + '"]'
				var rule = selector + ' { background-image: url(' + favIconUrl + '); background-color: transparent !important; }'
				stylesheet.insertRule(rule, stylesheet.cssRules.length)
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

function updateAllGroups() {
	clearAllGroups()
	generateSearchGroup()
	generateRecentGroup()
	generatePinnedFolderGroups()
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
		// console.log('onSet', items.pinnedFolders.oldValue, items.pinnedFolders.newValue)
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
	var query = document.querySelector('input#newtab-search-text')
	query.addEventListener('change', onQueryChange)
	query.addEventListener('keydown', onQueryChange)

	// Required for Chrome's clear button
	// https://stackoverflow.com/questions/2977023/how-do-you-detect-the-clearing-of-a-search-html5-input
	query.addEventListener('search', onQueryChange)

	var searchButton = document.querySelector('button#searchSubmit')
	searchSubmit.addEventListener('click', onQueryChange)
}

function getAllFolders_visitNode(folderList, bookmark) {
	var isChromeRoot = bookmark.id === '0' // Chrome root doesn't have dateGroupModified
	var isFolder = (typeof bookmark.type !== 'undefined'
		? bookmark.type === 'folder' // Firefox
		: typeof bookmark.dateGroupModified !== 'undefined' // Chrome
	)
	// console.log(bookmark.title, isFolder)
	if (isFolder || isChromeRoot) {
		if (bookmark.id != 'root________'
			&& bookmark.id != 'mobile______'
			&& !isChromeRoot
		) {
			folderList.push(bookmark)
		}
		if (Array.isArray(bookmark.children)) {
			for (var child of bookmark.children) {
				getAllFolders_visitNode(folderList, child)
			}
		}
	}
}

function getAllFolders(callback) {
	browserAPI.bookmarks.getTree(function(items){
		var root = items[0]
		// console.log('getTree', root)
		var folderList = []
		// console.log('getAllFolders_visitNode')
		getAllFolders_visitNode(folderList, root)
		callback(folderList)
	})
}

// https://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
function clearChildren(element) {
	var last
	while (last = element.lastChild) {
		last.remove()
	}
}

function sortFolders(folderList) {
	var prefOrder = [
		'toolbar_____',
		'menu________',
		'unfiled_____',
		'mobile______',
	]
	return folderList.sort(function(a, b){
		var aPrefIndex = prefOrder.indexOf(a.id)
		var bPrefIndex = prefOrder.indexOf(b.id)
		if (aPrefIndex == -1 && bPrefIndex == -1) {
			return b.dateGroupModified - a.dateGroupModified // Descending
		} else if (aPrefIndex >= 0 && bPrefIndex == -1) {
			return -1 // Prefered a should stay before b
		} else if (aPrefIndex == -1 && bPrefIndex >= 0) {
			return 1 // Prefered b should be before a
		} else { // aPrefIndex >= 0 && bPrefIndex >= 0
			return aPrefIndex - bPrefIndex // Ascending
		}
	})
}

function showEditBookmarkForm(bookmarkId) {
	// console.log('showBookmarkProperties', bookmarkId)
	browserAPI.bookmarks.get([bookmarkId], function(items){
		var bookmark = items[0]
		var editBookmarkForm = document.querySelector('form.edit-bookmark-form')
		editBookmarkForm.setAttribute('data-id', bookmark.id)

		var bookmarkTitleInput = editBookmarkForm.querySelector('input#edit-bookmark-title')
		bookmarkTitleInput.value = bookmark.title

		var bookmarkUrlInput = editBookmarkForm.querySelector('input#edit-bookmark-url')
		bookmarkUrlInput.value = bookmark.url

		getAllFolders(function(folderList){
			// console.log('getAllFolders', folderList)
			sortFolders(folderList)
			// console.log('sortFolders', folderList)
			var bookmarkFolderSelect = editBookmarkForm.querySelector('select#edit-bookmark-folder')
			clearChildren(bookmarkFolderSelect)
			for (var folder of folderList) {
				var option = document.createElement('option')
				option.setAttribute('value', folder.id)
				option.textContent = folder.title
				if (folder.id == bookmark.parentId) {
					option.setAttribute('selected', 'selected')
				}
				bookmarkFolderSelect.appendChild(option)
			}

			var editBookmarkWrapper = document.querySelector('.edit-bookmark-wrapper')
			editBookmarkWrapper.classList.remove('hidden')
		})
	})
}

function closeEditBookmark() {
	var editBookmarkWrapper = document.querySelector('.edit-bookmark-wrapper')
	editBookmarkWrapper.classList.add('hidden')
}
function updateBookmark(bookmarkId, changes, destination, callback) {
	console.log('updateBookmark', bookmarkId, changes, destination)
	browserAPI.bookmarks.update(bookmarkId, changes, function(bookmark){
		if (destination) {
			browserAPI.bookmarks.move(bookmarkId, destination, callback)
		} else {
			callback(bookmark)
		}
	})
}
function onEditBookmarkSubmit(event){
	event.preventDefault()
	var bookmarkId = this.getAttribute('data-id')
	console.log('submit', bookmarkId)
	var editBookmarkForm = document.querySelector('form.edit-bookmark-form')
	var bookmarkTitleInput = editBookmarkForm.querySelector('input#edit-bookmark-title')
	var bookmarkUrlInput = editBookmarkForm.querySelector('input#edit-bookmark-url')
	var bookmarkFolderSelect = editBookmarkForm.querySelector('select#edit-bookmark-folder')
	var bookmarkFolderOption = bookmarkFolderSelect.selectedOptions[0]
	var changes = {
		title: bookmarkTitleInput.value,
		url: bookmarkUrlInput.value,
	}
	var destination = null
	if (bookmarkFolderOption.value && !bookmarkFolderOption.getAttribute('selected')) {
		// Was not selected when populated
		destination = {
			parentId: bookmarkFolderOption.value,
			// Not specifying index will place it at the bottom.
			// Since we reverse sort pinned folders, it'll appear at the top.
		}
	}
	updateBookmark(bookmarkId, changes, destination, function(bookmark){
		console.log('onUpdateBookmark', bookmark)
		closeEditBookmark()
		updateAllGroups()
	})
}
function onDeleteBookmarkClicked(event){
	var editBookmarkForm = this.closest('form.edit-bookmark-form')
	var bookmarkId = editBookmarkForm.getAttribute('data-id')
	// console.log('delete', bookmarkId)
	browserAPI.bookmarks.remove(bookmarkId, function(){
		// console.log('onDeleteBookmark', bookmark)

		// Remove elements
		var selector = '.place-entry[data-id="' + bookmarkId + '"]'
		document.querySelectorAll(selector).forEach(function(placeEntry){
			placeEntry.remove()
		})
	})
	closeEditBookmark()
}

function bindEditBookmarkForm() {
	var editBookmarkForm = document.querySelector('form.edit-bookmark-form')
	var deleteButton = editBookmarkForm.querySelector('.edit-bookmark-delete')
	deleteButton.addEventListener('click', onDeleteBookmarkClicked)
	var cancelButton = editBookmarkForm.querySelector('.actions .cancel')
	cancelButton.addEventListener('click', closeEditBookmark)
	editBookmarkForm.addEventListener('submit', onEditBookmarkSubmit)
}

function init() {
	generateSearchGroup()
	generateRecentGroup()
	loadConfig()

	browserAPI.storage.onChanged.addListener(onStorageChange)
	bindSearchInput()
	bindEditBookmarkForm()
}

document.addEventListener("DOMContentLoaded", init)

