//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const session = require("express-session");
const nodemailer = require("nodemailer");
require('dotenv').config();

const homeStartingContent = "Welcome, I'm Zsofi and this is my personal blog. ";
const homeStartingContent2 = "Here I write stuff when I have some thoughts to share, or want to vent, basically it's a little journal. I hope you'll have a look, and don't forget to leave some comments.";
const aboutContent = "My name is Zsofi, the proud owner of this little journal. You can find me in the kitchen (baking or enjoying good food), in my climbing gym, or somewhere in the world travelling. Well, or I may be at home relaxing, having a good time with my favourite person, or watching k-dramas. This journal started its life as a web development project, practising working with Node.js, Express, MongoDB, EJS. Then I added some more meaningful content than \"Lorem Ipsum\" and here we are. You can get in touch with me, see the contact page, or leave comments. Have a great day.";
const contactContent = "If you have questions, want to see my projects or just want to talk, or any other reason to contact me, see my details below, or leave a message.";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static("public"));
app.use(fileUpload());
app.use(session({
  secret: "Our little secret",
  resave: false,
  saveUninitialized: false
}));
app.use(function(req, res, next) {
  res.locals.userId = req.session.userId;
  res.locals.username = req.session.username;
  next();
});

// mongoose.connect("mongodb://localhost:27017/blogDB", {useNewUrlParser: true, useUnifiedTopology: true});

mongoose.connect("mongodb+srv://" + process.env.MONGO_ID + ":" + process.env.MONGO_PASS + "@cluster0-mbatm.mongodb.net/blogDB", {useNewUrlParser: true, useUnifiedTopology: true});

const commentSchema = {
  name: String,
  date: Date,
  comment: String,
  commentid: String,
}

const Comment = mongoose.model("Comment", commentSchema);

const postSchema = {
  title: String,
  content: String,
  date: Date,
  image: String,
  username: String,
  tags: Array,
  likes: Number,
};

const Post = mongoose.model("Post", postSchema);

const bloggerSchema = {
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
};

const Blogger = new mongoose.model("Blogger", bloggerSchema);


app.get("/", function(req, res){
  Post.find({}, null, {sort: { date : "desc" }}, function(err, foundPosts){

    Comment.find({
    }, function(err, foundComments) {

    res.render("home", {
      startingContent: homeStartingContent,
      startingContent2: homeStartingContent2,
      posts: foundPosts,
      comments: foundComments,
      });
  })
});
});

app.get("/about", function(req, res){
  res.render("about", {aboutContent: aboutContent});
});

app.get("/contact", function(req, res){
  res.render("contact", {contactContent: contactContent});
});

app.get("/compose", function(req, res){
  if (req.session.userId) {
      return res.render("compose");
  }
  res.redirect("/")

});
app.get("/register", function(req, res) {
  res.render("register");
});
app.get("/login", function(req, res) {
  if (!req.session.userId) {
    return res.render("login");
  }
    res.redirect("/");
})
app.get("/logout", function(req, res) {
  req.session.destroy(() => {
    res.redirect("/");
  })
});

app.get("/contact-failure", function(req, res) {
  res.render("/contact-failure");
});
app.get("/contact-success", function(req, res) {
  res.render("/contact-success");
  });

app.get("/delete/:postId", function(req,res) {
  console.log("id: " + req.params.postId);
  if (req.session.userId) {
    Post.deleteOne({ _id: req.params.postId}, function (err) {
      if (err) {
        console.log(err);
        res.redirect("/");
      } else {
        Comment.deleteMany({ commentid: req.params.postId}, function (err){
          if (err) {
            console.log(err);
            res.redirect("/");
          } else {
            res.redirect("/");
          }
        })
      }
    })
  } else {
    res.redirect("/");
  }
});

app.post("/compose",[
  check("postTitle").not().isEmpty(),
  check("postBody").not().isEmpty(),
], function(req, res) {

      ////////////////////////////////////////
          const result=validationResult(req);
          var errors = result.errors;

          if (!result.isEmpty()) {
            res.render("compose", {
              errors: errors
            });
          } else
          {
        //////////////
            const post = new Post({
              title: req.body.postTitle,
              content: req.body.postBody,
              date: new Date(),
              image: req.body.postImage,
              username: req.session.username,
              tags: req.body.postTags
            });

              post.save(function(err) {
                if (!err) {
                    res.redirect("/");
                }
              })
        ///////////////
    }
  });

app.post("/register", function(req, res) {
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
      const blogger = new Blogger({
        username: req.body.username,
        email: req.body.email,
        password: hash,
    });
    blogger.save(function(err) {
      if (err) {
        console.log(err);
      } else {
        res.render("login");
      }
    })
  });
});

app.post("/login", function(req, res) {
  const email = req.body.email;
  const password = req.body.password;
  // checking if this username with password exists in the database:
  Blogger.findOne({email: email}, function(err, foundBlogger) {
    if(err) {
      console.log(err);
    } else {
      if (foundBlogger) {
        bcrypt.compare(password, foundBlogger.password, function(err, result) {
          if (result === true) {
            req.session.userId = foundBlogger._id;
            req.session.username = foundBlogger.username;
            res.redirect("/");
          } else {
            res.render("login");
          }
        });
      } else {
        res.redirect("/login");
      }
      }
    });
});
app.post("/contact", (req, res) => {
  const smtpTrans = nodemailer.createTransport({
    service: "hotmail",
    auth: {
      user: process.env.HOTMAIL_USER,
      pass: process.env.HOTMAIL_PASS,
    }
  })

  const mailOptions = {
    from: "Your sender info here",
    to: process.env.HOTMAIL_USER,
    subject: "New message from contact form at Zsofi's blog",
    text: `${req.body.name} (${req.body.email}) says: ${req.body.message}`
  }

  smtpTrans.sendMail(mailOptions, (error, response) => {
    if (error) {
      res.render("contact-failure");
      console.log(error);
    } else {
      res.render("contact-success")
    }
  })
})

app.route("/posts/:postId")
.get(function(req, res){

  const requestedPostId = req.params.postId;
  Post.findOne({_id: requestedPostId}, function(err, post) {
    var options = { day: "numeric", month: "short", year: "numeric"};
    Comment.find({
        commentid: requestedPostId
    }, function(err, foundComments) {
      if (!err) {
        res.render("post", {
          title: post.title,
          content: post.content,
          image: post.image,
          date: post.date.toLocaleString("en-GB", options ),
          username: post.username,
          tags: post.tags,
          id: post._id,
          likes: post.likes,
          comments: foundComments,
      })
    } else {
      console.log(error)
    }

  })
})
})

.post(function(req, res) {

  const comment = new Comment({
    name: req.body.commentName,
    date: new Date(),
    comment: req.body.commentBody,
    commentid: req.body.postId,
  });
    comment.save(function(err) {
      if (!err) {
          res.redirect("/");
      } else {
        res.render("/");
      }
    })
      console.log(req.body);
})
;

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
