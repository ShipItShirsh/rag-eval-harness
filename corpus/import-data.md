---
id: import-data
title: Importing data
---

# Importing data

You can import tasks into a project from a **CSV file**. Go to the project,
choose **… → Import**, and upload the file. The CSV must have a column
named **Title**; optional columns are **Assignee email**, **Due date**
(YYYY-MM-DD), and **Status** (To do, In progress, or Done).

Rows with an assignee email that does not belong to a workspace member are
imported as unassigned tasks, and the import report lists them. A single
import can contain at most **1,000 rows**; larger files must be split.

TaskNest does not offer direct importers from other tools (such as Asana,
Trello, or Monday). To move from another tool, export your data there as
CSV and import the CSV here. Attachments cannot be imported.
