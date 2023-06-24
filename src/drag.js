// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API

// Inherits config from newtab.js

var draggedGroup = null
var draggedEntry = null

var style = document.createElement('style')
var css = ''
css += '.dragging { opacity: 0.5; }'
css += '.draghover { background: linear-gradient(var(--newtab-textbox-focus-color), transparent 1px); }'
style.textContent = css
document.head.appendChild(style)

document.addEventListener('dragstart', function(event){
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetEntry = targetEl.closest('.place-entry')
	if (targetEntry) {
		// console.log('dragstart', targetEntry, event)
		draggedEntry = targetEntry
		targetEntry.classList.add('dragging')
		return
	}
	var targetGroupHeading = targetEl.closest('.kanban-group-heading')
	var targetGroup = targetEl.closest('.kanban-group')
	if (targetGroupHeading && targetGroup) {
		event.dataTransfer.setData('text/plain', '')
		draggedGroup = targetGroup
		targetGroup.classList.add('dragging')
		return
	}
})
document.addEventListener('dragend', function(event){
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	if (draggedEntry) {
		var targetEntry = targetEl.closest('.place-entry')
		if (targetEntry) {
			// console.log('dragend', targetEntry, event)
			targetEntry.classList.remove('dragging')
		}
		draggedEntry = null
		return
	} else if (draggedGroup) {
		var targetGroup = targetEl.closest('.kanban-group')
		if (targetGroup) {
			// console.log('dragend', targetGroup, event)
			targetGroup.classList.remove('dragging')
		}
		draggedGroup = null
		return
	}
})

document.addEventListener('dragover', function(event){
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	if (draggedEntry) {
		var targetEntry = targetEl.closest('.place-entry')
		var targetGroup = null
		if (targetEntry) {
			targetGroup = targetEntry.closest('.kanban-group')
		} else {
			targetGroup = targetEl.closest('.kanban-group')
		}
		// console.log('dragover', 'targetEntry', targetEntry, 'targetGroup', targetGroup)
		if (!targetGroup) {
			return
		}
		var targetGroupId = targetGroup.getAttribute('data-id')
		if (!canModifyGroup(targetGroupId)) {
			return
		}
		if (targetEntry) {
			targetEntry.classList.add('draghover')
		} else { // targetGroup
			targetGroup.classList.add('draghover')
		}
		event.preventDefault()
		return
	} else if (draggedGroup) {
		var targetGroup = targetEl.closest('.kanban-group')
		if (targetGroup) {
			// console.log(targetGroup, event)
			var targetGroupId = targetGroup.getAttribute('data-id')
			if (!canModifyGroup(targetGroupId)) {
				return
			}
			targetGroup.classList.add('draghover')
			event.preventDefault()
		}
		return
	}
})
document.addEventListener('dragleave', function(event){
	// console.log('dragleave', event)
	if (!draggedEntry && !draggedGroup) {
		return
	}
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	var targetDragHover = targetEl.closest('.draghover')
	if (targetDragHover) {
		// console.log(targetDragHover, event)
		targetDragHover.classList.remove('draghover')
	}
})
document.addEventListener('drop', function(event){
	// console.log('drop', event)
	var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
	if (draggedEntry) {
		// console.log('draggedEntry', draggedEntry)
		var targetEntry = targetEl.closest('.place-entry')
		// console.log('targetEntry', targetEntry)
		if (targetEntry) {
			// Prevent opening target link
			event.preventDefault()

			// Cleanup style since dragleave won't fire.
			targetEntry.classList.remove('draghover')

			dropEntryOnEntry(targetEntry)
			return
		}
		var targetGroup = targetEl.closest('.kanban-group')
		// console.log('targetGroup', targetGroup)
		if (targetGroup) {
			// Cleanup style since dragleave won't fire.
			targetGroup.classList.remove('draghover')

			dropEntryOnGroup(targetGroup)
			return
		}
		// Invalid drop
		return
	} else if (draggedGroup) {
		// console.log(draggedGroup)
		var targetGroup = targetEl.closest('.kanban-group')
		// console.log('targetGroup', targetGroup)
		if (!targetGroup) {
			return
		}

		// Cleanup style since dragleave won't fire.
		targetGroup.classList.remove('draghover')

		dropGroup(targetGroup)
		return

	}
})

function dropEntryOnEntry(targetEntry) {
	// console.log('dropEntryOnEntry', targetEntry)
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

	browserAPI.bookmarks.get([
		draggedId,
		targetId,
	], function(items){
		// console.log('items', items)
		var draggedBookmark = items[0]
		var targetBookmark = items[1]
		var destination = {
			parentId: targetGroupId,
		}
		if (targetBookmark.parentId == targetGroupId) {
			// console.log('config', config)
			if (config && config.bookmarkFoldersReversed) {
				// We want to display the draggedBookmark above the targetBookmark.
				// Since the bookmarks are sorted in reverse order, we tell the
				// API to place it after the targetBookmark.
				destination.index = targetBookmark.index+1
			} else {
				// When bookmarks are sorted in normal order, push everything else
				// down and take the index of the dropped location.
				destination.index = targetBookmark.index
			}
		} else {
			// Current tab is out of sync, targetBookmark has moved folders.
			// We'll place the bookmark at the bottom of the target group.
		}
		// console.log('destination', destination)

		browserAPI.bookmarks.move(draggedId, destination, function(bookmark) {
			// console.log('onMoveBookmark', bookmark)
			// Handled in newtab.js's browserAPI.bookmarks.onMoved
		})
	})
}

function dropEntryOnGroup(targetGroup) {
	// console.log('dropEntryOnGroup', targetGroup)
	var draggedId = draggedEntry.getAttribute('data-id')
	if (!draggedId) {
		return
	}
	var draggedGroup = draggedEntry.closest('.kanban-group')
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
	// We'll place the bookmark at the bottom of the target group.
	var destination = {
		parentId: targetGroupId,
	}
	browserAPI.bookmarks.move(draggedId, destination, function(bookmark) {
		// console.log('onMoveBookmark', bookmark)
		// Handled in newtab.js's browserAPI.bookmarks.onMoved
	})
}

function dropGroup(targetGroup) {
	var draggedGroupId = draggedGroup.getAttribute('data-id')
	var targetGroupId = targetGroup.getAttribute('data-id')
	// console.log('draggedGroupId', draggedGroupId)
	// console.log('targetGroupId', targetGroupId)
	if (!draggedGroupId || !targetGroupId) {
		return
	}
	if (draggedGroupId === targetGroupId || !canModifyGroup(targetGroupId)) {
		return
	}

	insertBeforePinnedFolder(draggedGroupId, targetGroupId)
}
