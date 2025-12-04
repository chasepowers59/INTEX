# Ella Rises - INTEX Project 2025
Admin Login: email: ella.johnson0@learners.net and password: EllaJohnson
User Login: Create your own or you can use email: cvpowers@byu.edu and password: chase0903


## About This Project

This is our capstone project for INTEX 2025. We built a comprehensive web application for **Ella Rises**, a nonprofit organization dedicated to empowering Latina youth through heritage, education, and sisterhood. The platform helps manage participants, events, donations, surveys, and provides analytics to track the organization's impact.

## Team Members

- **Chase**
- **Ethan**
- **Chad**
- **Jalen**

## Project Overview

Ella Rises needed a better way to manage their programs and track their impact. We created a full-stack web application that allows them to:

- **Manage Participants**: Track student information, milestones, and progress
- **Organize Events**: Schedule and manage workshops, summits, and other programs
- **Process Donations**: Accept and track donations from supporters
- **Collect Feedback**: Gather survey responses from event participants
- **View Analytics**: Dashboard with KPIs, charts, and insights to measure program effectiveness

## Tech Stack

We built this using:

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Knex.js for query building
- **Frontend**: EJS templating with Bootstrap 5
- **Authentication**: Passport.js with local strategy
- **Security**: Helmet.js for security headers, session management
- **Visualization**: Chart.js for analytics charts
- **Deployment**: AWS Elastic Beanstalk

## Features

### For Visitors
- Browse events and programs
- Make donations
- Learn about Ella Rises' mission
- Contact the organization

### For Participants
- View personal profile ("One Kid Hub")
- See upcoming events and registration status
- Track education milestones
- Submit event feedback surveys
- View donation history

### For Administrators
- Comprehensive admin dashboard with KPIs
- User and participant management
- Event creation and management
- Survey review and analysis
- Donation tracking and insights
- Milestone management
- Advanced analytics with trend charts
- Role-based access control (read-only for common users, full access for admins)

## Getting Started

### Prerequisites

- Node.js (v20.x)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd INTEX-3
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with:
```
NODE_ENV=development
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=ella_rises
SESSION_SECRET=your_session_secret
```

4. Run database migrations:
```bash
npm run migrate
```

5. Seed the database (optional):
```bash
npm run seed
```

6. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:8080`

## Project Structure

```
INTEX-3/
├── controllers/          # Route handlers and business logic
├── middleware/           # Authentication and upload middleware
├── migrations/           # Database schema migrations
├── public/              # Static assets (CSS, images)
├── routes/              # Express route definitions
├── seeds/               # Database seed files
├── views/               # EJS templates
├── analytics/           # Python analysis scripts
└── index.js             # Main application entry point
```

## Key Features Implemented

### Database Design
- Normalized database schema (3NF)
- ERD documentation
- Proper relationships between entities

### Security
- Password authentication (currently plaintext for development)
- Role-based access control
- Session management
- CSRF protection ready (currently disabled for development)
- Helmet.js security headers

### Analytics
- Dashboard with real-time KPIs
- Trend charts for attendance, satisfaction, and donations
- Event impact insights
- Donation insights with top donors
- Python exploratory data analysis scripts

### User Experience
- Responsive design for mobile and desktop
- Clean, modern UI matching Ella Rises branding
- Intuitive navigation
- Flash messages for user feedback
- Confirmation dialogs for destructive actions

## Special Features

### HTTP 418 - I'm a Teapot
We implemented the RFC 2324 "I'm a Teapot" status code as an easter egg. Click the teapot icon next to the logo to see it!

### Advanced Analytics Dashboard
The admin dashboard includes:
- Real-time KPI cards
- Interactive charts showing trends over time
- Filterable data by event type, city, and participant role
- Recent activity feed
- Top performers section

## Challenges We Overcame

- **Database Normalization**: Ensuring our schema followed 3NF while maintaining performance
- **Role-Based Access Control**: Implementing read-only access for common users while giving admins full control
- **Data Consistency**: Making sure all analytics calculations use the same filtered datasets
- **UI/UX**: Creating a cohesive design that represents Ella Rises' mission and values
- **Deployment**: Getting everything working on AWS Elastic Beanstalk

## Future Improvements

If we had more time, we'd like to:
- Add email notifications for event registrations
- Implement password hashing (currently plaintext for development)
- Add photo upload functionality for participants
- Create a mobile app
- Add more advanced reporting features
- Implement real-time notifications

## Acknowledgments

Thank you to Ella Rises for allowing us to work on this meaningful project. It's been an incredible learning experience building something that will actually help empower Latina youth in our community.

## License

This project was created for INTEX 2025 as part of our capstone requirements.

---

**Note**: This application is currently in development. Some features (like password hashing) are simplified for the development environment and should be enhanced before production deployment.

