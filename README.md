# Schedulus

A Chat Bot on Cisco Spark that helps organizations check, post, and update their Employee Schedules on a weekly basis.

This App is built using Cisco Spark's API, NodeJS, Express, and Firebase. Hosted on AWS EC2.

### Chat Commands ###
See Full Schedule: @Schedulus schedule

See Personal Schedule: @Schedulus Firstname-schedule

Call in Sick/Cancel Shift: @Schedulus Firstname-Day-away

Take Shift: @Schedulus Firstname-Day-Hours(e.g. 10:30-15:30)-take

Add an Employee: @Schedulus Firstname-add

Load a full week of work: @Schedulus Firstname-fullweek

Delete Last Weeks Schedule: @Schedulus -newweek

View List of Commands: @Schedulus -info
