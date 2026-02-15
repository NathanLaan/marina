Next, we are going to implement a data syncing system.

The syncing system will be based on Git, using GitHub. The user will need to provide a Git repository, which Threadline will connect to using existing SSH credentials. The repository will have a configuration/ directory that the app will commit, push, and pull configuration data to and from. The repository will also have a data/ directory that the app will commit, push, and pull RSS feeds, and feed read-status to. The user will need to specify a folder location where the data is to be stored, likely the first time the app is run, or if the data storage location is not set.

In order to sync, consider re-writing the back-end from SQLITE, so that we do not have to send the entire SQLITE database file up to Git, and using simple JSON. A JSON file for the index of RSS feeds, and a JSON file for storing the read status of every item in the feed might work.

The Threadline application will have two new toolbar buttons in the left side toolbar. The first will be a "Mark all as Read" button, and the second will be a "Mark all as Unread" button. The buttons will only be enabled when the user has selected a feed in the feed list. If the user has a feed selected, but not a feed item within that feed, items will be marked as read or unread when the user clicks the respective "Mark all..." button. If the user has a feed selected, and a feed item within the feed selected, then 

The Threadline application will have a "Sync" modal dialog, which will appear when the user clicks a new "Sync" button in the left side toolbar.

Threadline will have a new setting in the settings modal dialog called "Sync Wait Time", with a dropdown containing defaults of 5 seconds, 10 seconds, 30 seconds, and 60 seconds.

When the user performs an action, such as adding a new Feed, deleting a feed, editing a feed, reading a feed item, marking a feed item as read or unread, the appropriate data file is updated, the file is committed to the local data storage location, and a new Command is added to a list of Sync commands, and a time is set, using the "Sync Wait Time". When the sync time reaches 0 (zero), the Sync command pushes the changes to the repo.

Please review these specifications, identify any potential issues with the plan, and create a detailed implementation plan. Save the detailed implementation plan to docs/plan-sync-implementation.md