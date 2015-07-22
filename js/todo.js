

$(document).ready(function(){


    /**
     * App setup
     */

    // Global text variables
    var defaultTitle = 'Quicklist';
    var anotherPrompt = 'Add another...';
    var emptyPrompt = 'What do you need to do?';
    var newUserPrompt = 'What do you need to do? Doubleclick here to add a task...';

    // Action triggered when a task is single-clicked
    var clickAction = 'none';

    // Data: title, tasks, order
    var data = {};

    // Undo stack
    var oldData = [];

    // Get saved date from local storage
    var savedData = JSON.parse(localStorage.getItem('data'));

    // If localstorage had an item called "data"
    // use it to build the task list
    if (savedData) { 
        data = savedData;
        buildDOMList();
    }
    // If there's saved data at all, set up an empty data object
    else { 
        data.title = defaultTitle;
        data.tasks = {};
        data.order = [];
        toggleHelp(); // Show help (potential first-time visitor)
        setState(true); // True = first-time user, special message
    }

    // Make list items sortable (using JQuery UI Sortable Interaction)
    $('#tasklist').sortable({
        items: ".task",
        start: snapshot,
        update: updateOrderData
    });
    $('#tasklist').disableSelection();
    

    /**
     * Event handlers
     */

    //
    // List title handlers
    //

    // Make list title editable on doubleclick
    $('#title').dblclick(function(e) {
        $('#title').hide();
        $('#title-input').show().focus().val($('#title-input').val());
    });


    // Keyup handler for title input
    $('#title-input').keyup(function(e) {
        e.stopPropagation(); // document should not handle
        
        var key = e.which || e.keyCode;

        // If enter or escape was pressed, process input field
        if (key == 13 || key == 27) {
            $('#title-input').addClass('handled');
            editTitle();
        }
    });


    // Blur handler for title input
    $('#title-input').blur(function(e) {
        if (!$('#title-input').hasClass('handled')) {
            editTitle();
        }
        $('#title-input').removeClass('handled');
    });


    //
    // Document keystroke handler
    //

    // Handler for to (relevant) keyups outside an input
    $(document).keyup(function(e) {
        var key = e.which || e.keyCode;

        switch(key) {
            case 72: // h
                setAction('highlight');
                break;
            case 67: // c
                setAction('complete');
                break;
            case 68: // d
                setAction('delete');
                break;
            case 65: // a
                addBlankTask(true);
                break;
            case 83: // s
                if (!$('#autosort').prop('disabled')) {
                    autosort();
                }
                break;
            case 90: // z
                if (!$('#undo').prop('disabled')) {
                    undo();
                }
                break;         
            case 191:
                if (e.shiftKey) { // ?
                    toggleHelp();
                }
                break;
        }
    });


    //
    // Task input/span handlers
    //

    // Keyup handler for task input field
    function taskInputKeyupHandler(e) {
        e.stopPropagation(); // document should not handle

        var key = e.which || e.keyCode;

        // If enter or escape was pressed, process input field
        if (key == 13 || key == 27) {

            // Get task (parent li)
            var task = $(e.target).parent();

            // Flag as handled to stop blur handler
            task.addClass('handled');

            // Process edited input
            edited = editTask(task);

            // If enter was hit and the input had content
            // add another input for the next task
            if (key == 13 && edited) {
                addBlankTask(false, task);
            }
            // If escape was hit and/or the input had no content
            // AND there are still tasks in the list
            // show "Add another..." instead
            else  {
                $('#another').show();
            }
        }
    }


    // Blur handler for task input field
    // (when user clicks outside of input while editing a task)
    function taskInputBlurHandler(e) {

        // Get task (parent li)
        var task = $(e.target).parent();

        // Only process if not handled by keyup listener
        if (!task.hasClass('handled')) {

            // Process edited input
            editTask(task); 

            // Show prompt to add another item
            $('#another').show(); 

        }
        else {
            task.removeClass('handled'); // reset for future events
        }
    }


    // Click handler for task description spans
    // (Response depends on what clickAction is set)
    function taskSpanClickHandler(e) {
        // Get parent li
            var task = $(e.target).parent();

            // If a clickAction is set, process accordingly
            switch(clickAction) {
                case 'highlight':
                    task.toggleClass('highlighted');
                    snapshot(); // save data state in case of undo
                    updateTaskData(task);
                    break;
                case 'complete':
                    task.toggleClass('completed');
                    snapshot(); // save data state in case of undo
                    updateTaskData(task);
                    break;
                case 'delete':
                    deleteTask(task);
                    break;
            }
    }

    // Doubleclick handler for "Add another..." span
    $('#another').dblclick(function(e) {
        addBlankTask(true);
    });


    //
    // Button handlers
    //

    // Highlight, complete, and delete buttons
    $('.action').click(function(e) {
        var action = $(e.target).attr('id');
        setAction(action);
    });


    // Autosort button
    $('#autosort').click(function(e) {
        console.log('autosort clicked');
        autosort();
    });


    // Undo button
    $('#undo').click(function(e) {
        undo();
    });


    // Click handler for "undo" text that appears after deletion
    $('#undo-link').click(function(e) {
        undo();
    });

    // Help button
    $('#help').click(function(e) {
        toggleHelp();
    });


    /**
     * Functions used by event handlers
     */

    // Update list title
    function editTitle() {
        snapshot(); // Save state for undo

        // Get new title text, or revert to default if input is empty
        var newTitle = $('#title-input').val() ? $('#title-input').val() : defaultTitle;

        // Set H1 to new title and show it
        $('#title').text(newTitle).show();

        // Hide input
        $('#title-input').hide();

        // Update data and store
        data.title = newTitle;
        storeData();

    }


    // Allow a task to be edited by hiding description span 
    // and displaying and focusing editing input
    function makeTaskEditable(task) {
        $(task).children('.description').hide();
        // Resetting val after focus moves cursor to end of input
        $(task).children('input').show().focus().val($(task).children('input').val());
    }
    

    // Process input field to edit task
    // Return true if a task was added, updated, or unchanged
    // Return false if a task was deleted (because input was empty)
    function editTask(task) {

        // Get text from input
        var input = task.children('input');
        var newText = input.val();

        // If there's no text in the input, delete the task
        if (!newText) {
            deleteTask(task);
            return false;
        }
        // If the input task is the same as the span (no edit), do nothing
        else if (newText == task.children('.description').text()) {
            return true;
        }
        // Otherwise, we have new text, so update the task
        else {
            snapshot(); // save state in case of undo

            // If task was previously empty (new blank task)
            // add it to the task and order data
            if (task.hasClass('blank')) {
                data.tasks[task.attr('id')] = {};
                updateOrderData();
                task.removeClass('blank');
            } 

            // Update text in span, show span, hide input
            task.children('.description').text(newText).show();
            input.hide();
            updateTaskData(task);
            
            setState();
            return true;
        }
    }


    // Remove task from DOM and from data list
    function deleteTask(task) {

        // Save current data state in case of undo
        // unless we're just deleting an already empty task
        // that the user didn't mean to add
        if (!task.hasClass('blank')) {
            snapshot();
        }

        var id = task.attr('id');
        
        // Remove task from DOM and update order data
        task.remove();
        updateOrderData();

        // Remove task from task data and update localstorage
        delete data.tasks[id];
        storeData();

        setState();

        // Show undo message for 7 seconds
        // (stop currents fadeout if necessary)
        if (!task.hasClass('blank')) {
            $('#undo-wrapper').stop(true, true).show().delay(7000).fadeOut(1000);
        }
    }
    

    // Set action button classes and clickAction variable 
    // to control result of single-clicking on a task
    function setAction(action) {

        var targetButton = $('#'+action);

        // If there's no click action currently active
        // turn the action on
        if (clickAction == 'none') {
            targetButton.addClass('on');
            clickAction = action;
        }
        // If the action was already on, turn it off
        else if (clickAction == action) {
            targetButton.removeClass('on');
            clickAction = 'none';
        }
        // If another action was on, turn that action off
        // and turn the new action on
        else {
            $('#'+clickAction).removeClass('on');
            targetButton.addClass('on');
            clickAction = action;
        }
    }

    // Resort the task list putting highlighted tasks at the top
    // and completed task at the end
    function autosort() {

        var newOrder = [];

        // Build new order based on attributes
        //      1) Highlighted only
        $.each(data.order, function(index, id) {
            if (data.tasks[id].highlighted && !data.tasks[id].completed) {
                newOrder.push(id);
            }
        });

        //      2) Plain
        $.each(data.order, function(index, id) {
            if (!data.tasks[id].highlighted && !data.tasks[id].completed) {
                newOrder.push(id);
            }
        });

        //      3) Highlighted and completed
        $.each(data.order, function(index, id) {
            if (data.tasks[id].highlighted && data.tasks[id].completed) {
                newOrder.push(id);
            }
        });

        //      4) Completed only
        $.each(data.order, function(index, id) {
            if (!data.tasks[id].highlighted && data.tasks[id].completed) {
                newOrder.push(id);
            }
        });

        // See if order changed
        var orderChanged = false;
        $.each(data.order, function(index, id) {
            if (newOrder[index] != id) {
                orderChanged = true;
                return false;
            }
        });

        // If autosort affected the order, update it
        if (orderChanged) {
            snapshot();
            data.order = newOrder;
            buildDOMList();
            storeData();
        }
    }


    // Undo previous change (return to previous state in undo stack)
    function undo() {

        // Restore previous task and order data
        data = JSON.parse(JSON.stringify(oldData.pop()));

        // Rebuild task list in DOM and store data in localstorage
        buildDOMList();
        storeData();

        $('#undo-wrapper').hide(); // Hide undo message

        // Disable undo button if there's nothing left in the stack
        if (oldData.length == 0) {
            $('#undo').prop('disabled', true);
        }

        setState();

    }


    // Show/hide the help text
    function toggleHelp() {
        $("#help").toggleClass('on');
        $('#help-text').stop(true,true).slideToggle(700);
    }


    /**
     * General multi-purpose methods to set up and edit list
     */

    // Build list of tasks in DOM based on data
    // (used in initial setup, and for undo)
    function buildDOMList() {
        // Clear any current tasks from DOM
        $('.task').remove(); 

        // Set list title
        $('#title').text(data.title);
        $('#title-input').val(data.title);

        // Set up list from saved tasks
        if (!$.isEmptyObject(data.tasks)) {
            // Loop through order list, create tasks from 
            // task list in order
            var prevTask = null;
            $.each(data.order, function(index, id) {
                var taskData = data.tasks[id];
                var newTask = makeTask(prevTask, id, taskData);
                prevTask = newTask;
            });
        }
        setState();
    }


    // Add a new empty task to the DOM
    function addBlankTask(hideAnother, prevTask) {
        if (hideAnother) {
            $('#another').hide();
        }
        var newTask = makeTask(prevTask);
        makeTaskEditable(newTask);
    }


    // Make a new task (li) either with data or blank
    // and add to DOM after prevTask, or at top of list if empty
    function makeTask (prevTask, id, taskData) {

        // See if we're adding task from existing data
        // or creating a new empty task
        var isNew = !id ? true : false;
        
        // Make li to hold span and input
        var li = document.createElement('li');
        $(li).addClass('task');

        // If new, make new id, set class to blank
        // (to prevent deletion undo for brand new blank tasks)
        // and add an empty task to the task data
        if (isNew) {
            id = 'T' + (new Date().getTime());
            //data.tasks[id] = {};
            $(li).addClass('blank');
        }
        // Set id on li
        $(li).attr('id', id);  

        // Make span to display task and attach event listeners
        var span = document.createElement('span');
        $(span).attr('class', 'description');

        // Attach listeners to span to make editable on doubleclick
        // and respond to single clicks based on current clickAction
        $(span).dblclick(function(e) {
            makeTaskEditable($(e.target).parent());
        });
        $(span).click(taskSpanClickHandler);

        // Make input used for editing and hide to start
        var input = document.createElement('input');
        $(input).attr('type', 'text');
        $(input).hide();

        // Attach keyup and blur listeners to input
        $(input).keyup(taskInputKeyupHandler);
        $(input).blur(taskInputBlurHandler); 

        // If we have data, fill the task with it
        if (taskData) {
            // Set highlighted and completed classes if necessary
            if (taskData.highlighted) {
                $(li).addClass('highlighted');
            }
            if (taskData.completed) {
                $(li).addClass('completed');
            }
            // Add description text to span and input
            $(span).text(taskData.description);
            $(input).attr('value', taskData.description);
        }

        // Add span and input to li
        $(li).append(span);
        $(li).append(input);

        // Add li to DOM, either after prevTask 
        // or at end of list
        if (prevTask) {
            $(prevTask).after(li);
        }
        else {
            $('#another').before(li);
        }

        return li;

    }


    // Set up app state - which buttons/functions are available -
    // based on how many tasks are currently in the list
    function setState(newUser) {

        numTasks = data.order.length;
        console.log(numTasks);

        if (numTasks > 0) {
            $('.action').prop('disabled', false);
            $('#another').text(anotherPrompt);            
        }
        else {
            $('.action').prop('disabled', true);
            clickAction = 'none';
            if (newUser) {
                $('#another').text(newUserPrompt);
            }
            else {
                $('#another').text(emptyPrompt);
            }
        }

        if (numTasks > 1) {
            $('#autosort').prop('disabled', false);
        }
        else {
            $('#autosort').prop('disabled', true);
        }
    }


    // Add current state to undo stack for potential undo 
    function snapshot() {
        oldData.push(JSON.parse(JSON.stringify(data)));
        $('#undo').prop('disabled', false); // enable undo button
    }


    /**
     * Methods to update data and save to localstorage
     */

    // Update task list data
    function updateTaskData(task) {
        var id = task.attr('id');
        data.tasks[id].description = task.children('.description').text();
        data.tasks[id].highlighted = task.hasClass('highlighted');
        data.tasks[id].completed = task.hasClass('completed');
        storeData();
    }


    // Update order list data
    function updateOrderData(e, ui) {
        data.order = $('#tasklist').sortable('toArray');

        // If an event was passed in, the update was triggered by 
        // a sort, so store the new order. (If not, the update was
        // called by makeTask or deleteTask, which will call storeData.)
        if (e) {
            storeData();
        }
    }

    // Store latest version of data in localstorage
    function storeData() {
        window.localStorage.setItem('data', JSON.stringify(data));
    }

});