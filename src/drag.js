// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API

var draggedEntry = null

var style = document.createElement('style')
var css = ''
css += '.place-entry.dragging { opacity: 0.5; }'
css += '.place-entry.draghover { background: linear-gradient(var(--newtab-textbox-focus-color), transparent 1px); }'
style.innerHTML = css
document.head.appendChild(style)

document.addEventListener('dragstart', function(event){
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetEntry = targetEl.closest('.place-entry')
	if (targetEntry) {
		// console.log(targetEntry, event)
		draggedEntry = targetEntry
		targetEntry.classList.add('dragging')
	}
})
document.addEventListener('dragend', function(event){
	if (!draggedEntry) {
		return
	}
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetEntry = targetEl.closest('.place-entry')
	if (targetEntry) {
		// console.log(targetEntry, event)
		targetEntry.classList.remove('dragging')
	}
	draggedEntry = null
})


document.addEventListener('dragover', function(event){
	if (!draggedEntry) {
		return
	}
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetEntry = targetEl.closest('.place-entry')
	if (targetEntry) {
		// console.log(targetEntry, event)
		targetEntry.classList.add('draghover')
		event.preventDefault()
	}
})
document.addEventListener('dragleave', function(event){
	if (!draggedEntry) {
		return
	}
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetEntry = targetEl.closest('.place-entry')
	if (targetEntry) {
		// console.log(targetEntry, event)
		targetEntry.classList.remove('draghover')
	}
})
document.addEventListener('drop', function(event){
	// console.log(event)
	// console.log(draggedEntry)
	if (!draggedEntry) {
		return
	}
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetEntry = targetEl.closest('.place-entry')
	// console.log(targetEntry)
	if (!targetEntry) {
		return
	}

	// Prevent opening target link
	event.preventDefault()

	// Cleanup style since dragleave won't fire.
	targetEntry.classList.remove('draghover')

	var draggedId = draggedEntry.getAttribute('data-id')
	var targetId = targetEntry.getAttribute('data-id')
	if (!draggedId || !targetId || draggedId === targetId) {
		return
	}

	var draggedGroup = draggedEntry.closest('.kanban-group')
	var targetGroup = targetEntry.closest('.kanban-group')
	if (!draggedGroup || !targetGroup) {
		return
	}
	var draggedGroupId = draggedGroup.getAttribute('data-id')
	var targetGroupId = targetGroup.getAttribute('data-id')
	// console.log('draggedId', draggedId, 'draggedGroupId', draggedGroupId)
	// console.log('targetId', targetId, 'targetGroupId', targetGroupId)
	if (!draggedGroupId || !targetGroupId || !canModifyGroup(targetGroupId)) {
		return
	}

	// We need to create a reference of draggedEntry as the dragend event
	// will set draggedEntry=null before onMoveCallback is called.
	var _draggedEntry = draggedEntry

	browserAPI.bookmarks.get([
		draggedId,
		targetId,
	], function(items){
		console.log('items', items)
		var draggedBookmark = items[0]
		var targetBookmark = items[1]
		var destination = {
			parentId: targetGroupId,
		}
		var isOutOfSync = false
		if (targetBookmark.parentId == targetGroupId) {
			// We want to display the draggedBookmark above the targetBookmark.
			// Since the bookmarks are sorted in reverse order, we tell the
			// API to place it after the targetBookmark.
			destination.index = targetBookmark.index+1
		} else {
			// Current tab is out of sync, targetBookmark has moved folders.
			// We'll place the bookmark at the bottom of the target group.
			isOutOfSync = true
		}
		// console.log('destination', destination, 'isOutOfSync', isOutOfSync)

		browserAPI.bookmarks.move(draggedId, destination, function(bookmark) {
			console.log('onMoveBookmark', bookmark)

			if (isOutOfSync) {
				// Need a full refresh
				updateAllGroups()
				return
			}

			if (canModifyGroup(draggedGroupId)) {
				// Move element
				targetEntry.parentNode.insertBefore(_draggedEntry, targetEntry)
			} else {
				// Dragged from recent group. We first need to check if bookmark is visible.
				var selector = '.kanban-group:not([data-id="' + draggedGroupId + '"])'
				selector += ' .place-entry[data-id="' + draggedId + '"]'
				var otherEntry = document.querySelector(selector)
				if (otherEntry) {
					// Is visible, move otherEntry instead
					targetEntry.parentNode.insertBefore(otherEntry, targetEntry)
				} else {
					// Not visible, copy the dragged element
					var entry = generatePlaceEntry(bookmark)
					if (entry) {
						// Add new element
						targetEntry.parentNode.insertBefore(entry, targetEntry)
					} else {
						// Entry is filtered out in new group
					}
				}
			}
		})
	})
})
