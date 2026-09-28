UI REDESIGN RULE

The existing application's functionality is the source of truth.

Never:
- remove a feature
- replace working API calls with mock data
- change database schemas
- change authentication
- change business logic
- remove routes
- remove QR functionality
- remove tracking
- remove AI functionality
- remove map/location functionality

unless explicitly requested.

UI changes may modify:
- components
- CSS
- layout
- typography
- colors
- spacing
- animations
- responsive behavior
- visual hierarchy

but must preserve existing functionality.