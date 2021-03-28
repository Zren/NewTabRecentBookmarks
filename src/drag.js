// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API

var draggedEntry = null;

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
	if (draggedEntry) {
		var targetEl = typeof event.target.closest === 'function' ? event.target : event.target.parentNode
		var targetEntry = targetEl.closest('.place-entry')
		if (targetEntry) {
			console.log(event)
			console.log(draggedEntry)
			console.log(targetEntry)

			// Prevent opening target link
			event.preventDefault()

			// Cleanup style since dragleave won't fire.
			targetEntry.classList.remove('draghover')

			var group = targetEntry.closest('.kanban-group')
			console.log(group)

			// Move element
			targetEntry.parentNode.insertBefore(draggedEntry, targetEntry)
		}
	}
})
