const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const Thread = require('../models/Thread');

const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Tag.deleteMany({});
    await Thread.deleteMany({});

    // Create sample users
    const users = await User.create([
      {
        username: 'admin',
        email: 'admin@forum.com',
        password: 'Admin123!',
        role: 'admin',
        bio: 'Forum administrator',
        reputation: 1000
      },
      {
        username: 'john_dev',
        email: 'john@example.com',
        password: 'Password123!',
        bio: 'Full-stack developer passionate about JavaScript and React',
        reputation: 250
      },
      {
        username: 'sarah_designer',
        email: 'sarah@example.com',
        password: 'Password123!',
        bio: 'UI/UX designer who loves clean interfaces',
        reputation: 180
      },
      {
        username: 'mike_student',
        email: 'mike@example.com',
        password: 'Password123!',
        bio: 'Computer Science student learning web development',
        reputation: 50
      }
    ]);

    console.log('Created sample users');

    // Create categories
    const categories = await Category.create([
      {
        name: 'Programming',
        description: 'General programming discussions and questions',
        color: '#007bff',
        threadCount: 0
      },
      {
        name: 'Web Development',
        description: 'Frontend and backend web development topics',
        color: '#28a745',
        threadCount: 0
      },
      {
        name: 'Career',
        description: 'Career advice, job hunting, and professional development',
        color: '#ffc107',
        threadCount: 0
      },
      {
        name: 'Learning',
        description: 'Educational resources and learning paths',
        color: '#17a2b8',
        threadCount: 0
      },
      {
        name: 'General',
        description: 'General discussions and off-topic conversations',
        color: '#6c757d',
        threadCount: 0
      }
    ]);

    console.log('Created categories');

    // Create tags
    const tags = await Tag.create([
      { name: 'javascript', description: 'JavaScript programming language', usageCount: 0 },
      { name: 'react', description: 'React.js library', usageCount: 0 },
      { name: 'nodejs', description: 'Node.js runtime', usageCount: 0 },
      { name: 'python', description: 'Python programming language', usageCount: 0 },
      { name: 'css', description: 'Cascading Style Sheets', usageCount: 0 },
      { name: 'html', description: 'HyperText Markup Language', usageCount: 0 },
      { name: 'mongodb', description: 'MongoDB database', usageCount: 0 },
      { name: 'express', description: 'Express.js framework', usageCount: 0 },
      { name: 'beginner', description: 'Beginner-friendly content', usageCount: 0 },
      { name: 'career-advice', description: 'Career guidance and tips', usageCount: 0 }
    ]);

    console.log('Created tags');

    // Create sample threads
    const programmingCategory = categories.find(c => c.name === 'Programming');
    const webDevCategory = categories.find(c => c.name === 'Web Development');
    const careerCategory = categories.find(c => c.name === 'Career');

    const jsTag = tags.find(t => t.name === 'javascript');
    const reactTag = tags.find(t => t.name === 'react');
    const nodeTag = tags.find(t => t.name === 'nodejs');
    const beginnerTag = tags.find(t => t.name === 'beginner');
    const careerTag = tags.find(t => t.name === 'career-advice');

    const threads = await Thread.create([
      {
        title: 'Best practices for React component organization',
        content: `I'm working on a large React application and I'm struggling with how to organize my components. Currently, I have everything in a single components folder, but it's getting messy.

What are some best practices for organizing React components in a scalable way? Should I organize by feature, by component type, or some other method?

Any recommendations for folder structures that have worked well for you in production applications?`,
        author: users[1]._id,
        category: webDevCategory._id,
        tags: [reactTag._id, jsTag._id],
        votes: [
          { user: users[2]._id, type: 'upvote' },
          { user: users[3]._id, type: 'upvote' }
        ],
        replies: [
          {
            author: users[2]._id,
            content: `I've found that organizing by feature works really well for larger applications. Here's the structure I use:

src/
  features/
    auth/
      components/
      hooks/
      services/
    dashboard/
      components/
      hooks/
      services/
  shared/
    components/
    hooks/
    utils/

This way, everything related to a specific feature is co-located, making it easier to find and maintain.`,
            votes: [
              { user: users[1]._id, type: 'upvote' },
              { user: users[3]._id, type: 'upvote' }
            ],
            replies: [
              {
                author: users[1]._id,
                content: 'This looks great! Do you have any naming conventions for the component files within each feature?',
                votes: []
              }
            ]
          }
        ],
        views: 45
      },
      {
        title: 'How to transition from frontend to full-stack development?',
        content: `I've been working as a frontend developer for about 2 years now, primarily with React and TypeScript. I'm comfortable with HTML, CSS, JavaScript, and have good experience with modern frontend tooling.

Now I want to expand my skills to become a full-stack developer. I'm particularly interested in the MERN stack (MongoDB, Express, React, Node.js).

What would be the best learning path? Should I focus on Node.js first, or start with databases? Any recommended resources or projects to get started?

Also, how long did it take you to make this transition, and what challenges should I expect?`,
        author: users[3]._id,
        category: careerCategory._id,
        tags: [careerTag._id, nodeTag._id, beginnerTag._id],
        votes: [
          { user: users[1]._id, type: 'upvote' },
          { user: users[2]._id, type: 'upvote' }
        ],
        replies: [
          {
            author: users[1]._id,
            content: `Great question! I made this transition about a year ago. Here's what worked for me:

1. Start with Node.js basics - since you already know JavaScript, this will feel familiar
2. Learn Express.js for building APIs
3. Get comfortable with databases (I started with MongoDB since it's JSON-like)
4. Build a few full-stack projects to tie everything together

The key is to build projects that connect frontend and backend. Start small - maybe a todo app with user authentication, then gradually add more complex features.

It took me about 6 months of consistent learning (2-3 hours daily) to feel confident applying for full-stack positions.`,
            votes: [
              { user: users[3]._id, type: 'upvote' },
              { user: users[2]._id, type: 'upvote' }
            ]
          }
        ],
        views: 78
      },
      {
        title: 'Understanding JavaScript closures with practical examples',
        content: `I keep hearing about closures in JavaScript, but I'm having trouble understanding when and why to use them. I've read the MDN documentation, but I'd love to see some practical, real-world examples.

Can someone explain closures in simple terms and show me some use cases where they're actually useful in modern JavaScript development?

Bonus points if you can show examples that I might encounter in React or Node.js applications!`,
        author: users[3]._id,
        category: programmingCategory._id,
        tags: [jsTag._id, beginnerTag._id],
        votes: [
          { user: users[1]._id, type: 'upvote' }
        ],
        replies: [],
        views: 23
      }
    ]);

    console.log('Created sample threads');

    // Update tag usage counts
    await Tag.findByIdAndUpdate(reactTag._id, { usageCount: 1 });
    await Tag.findByIdAndUpdate(jsTag._id, { usageCount: 2 });
    await Tag.findByIdAndUpdate(nodeTag._id, { usageCount: 1 });
    await Tag.findByIdAndUpdate(beginnerTag._id, { usageCount: 2 });
    await Tag.findByIdAndUpdate(careerTag._id, { usageCount: 1 });

    // Update category thread counts
    await Category.findByIdAndUpdate(programmingCategory._id, { threadCount: 1 });
    await Category.findByIdAndUpdate(webDevCategory._id, { threadCount: 1 });
    await Category.findByIdAndUpdate(careerCategory._id, { threadCount: 1 });

    console.log('Database seeding completed successfully!');
    console.log('\nSample accounts created:');
    console.log('Admin: admin@forum.com / Admin123!');
    console.log('User: john@example.com / Password123!');
    console.log('User: sarah@example.com / Password123!');
    console.log('User: mike@example.com / Password123!');

  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

module.exports = seedDatabase;

// Run seeding if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forum_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    return seedDatabase();
  })
  .then(() => {
    console.log('Seeding completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}