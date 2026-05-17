Add the ability for the user to create user-defined tags to organize their feeds. The user can define as many tags as they want. The user can        
  associate 0 (zero) or as many tags as they want with each feed.

Here is my initial idea for the UI:
  
Create a new "Tags" button in the toolbar. Clicking this button will open a new modal dialog box, with Add, Edit, and Delete buttons in the toolbar on the left side, a list control in the middle. Clicking the add button allows the user to add a new tag in a model dialog box
  
Clicking edit allows the user to edit the selected tag, opening it in the modal dialog for editing. Editing the tag and clicking ok edits it, and updates all the tag on all feeds that referenced it.

Divide the feed list into two controls; one on top with the existing feed list, and one on bottom with a multi-select list of tags. Clicking on a feed highlights the tags already assigned to the feed. Selecting more tags assigns them to the feed. De-selecting a tag that is assigned to a feed un-assigns it from the feed.

We will add a simple filter capability to the UI later, allowing users to filter fields.

