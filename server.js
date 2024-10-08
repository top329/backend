const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');
const syncHistory = require('./controllers/syncHistory');
const syncTrade = require('./controllers/syncTrade');
const Notification = require('./models/Notification');
const User = require('./models/User');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
    credentials: true,
  },
});
// Connect Database
connectDB();

// Init Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// Define Routes
app.use('/api/account', require('./routes/api/account'));
app.use('/api/subscriber', require('./routes/api/subscriber'));
app.use('/api/strategy', require('./routes/api/strategy'));
app.use('/api/users', require('./routes/api/users'));
app.use('/api/history', require('./routes/api/history'));
app.use('/api/trade', require('./routes/api/trade'));
app.use('/api/settings', require('./routes/api/setting'));
app.use('/api/notification', require('./routes/api/notification'));

// Serve static assets in production
// if (process.env.NODE_ENV === 'production') {
//   // Set static folder
//   app.use(express.static('client/build'));

//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
//   });
// }

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '45.8.22.219';

io.on('connection', (socket) => {
  console.log('Client connected!');
  socket.on('disconnect', () => {
    console.log('Client disconnected!');
  });

  socket.on('message', async (msg) => {
    try {
      if (msg.type === 'provider-request') {
        console.log(msg);
        const result = await User.findById(msg.payload.user);
        if (!result) {
          socket.emit('result', {
            type: 'error',
            payload: { msg: 'User not found!' },
          });
        } else if (result.isPending === true) {
          socket.emit('result', {
            type: 'error',
            payload: { msg: 'You are already pending!' },
          });
        } else {
          result.isPending = true;
          result.save();
          const data = await Notification.findOne({ user: msg.payload.user });
          if (!data) {
            const data = new Notification();
            data.user = msg.payload.user;
            data.isNotViewed = true;
            data.save();
          } else {
            data.isNotViewed = true;
            data.save();
          }
          socket.emit('result', {
            type: 'success',
            payload: { msg: 'Provider request sent!' },
          });
          socket.broadcast.emit('alert', {
            type: 'notification',
            payload: { user: msg.payload.user, isNotViewed: true },
          });
        }
      }
    } catch (err) {
      console.log(err);
    }
  });
});

http.listen(PORT, () => console.log(`Server started on port ${PORT}`));
// app.listen(PORT, HOST, () => console.log(`Server started on port ${PORT} and on host ${HOST}`));

setInterval(() => {
  syncHistory();
  syncTrade();
}, 60000 * 5);

// syncTrade();
// syncHistory();
