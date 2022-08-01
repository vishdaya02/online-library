require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const multer = require("multer");
const fs = require('fs');
var path = require('path');

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json())

app.use(session({
  secret: "this is a secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/libprojectDB");

const userSchema = new mongoose.Schema({ //no longer just a schema object .. but object that is created from mongoose schema class
  email: String,
  password: String,
  googleId: String,
  books: {
    type: Array,
    "default": []
  }
});
const bookSchema = new mongoose.Schema({
    name: {
      type:String,
      required:true
    },
    category:{
      type:String,
      required:true
    },
    wikiLink: {
      type:String,
    },
    author:String,
    coverimg:
    {
        data: Buffer,
        contentType: String
    },
    file:
    {
        data: Buffer,
        contentType: String
    }

});

// const bookSchema=new mongoose.Schema({
//   name:String,
//   wikiLink:String,
//   category:String
// });

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Book = new mongoose.model("Book", bookSchema);

passport.use(User.createStrategy());


passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/home",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});

var upload = multer({ storage: storage });

var uploadMultiple=upload.fields([{name:"coverimg",maxCount:1},{name:"file",maxCount:1}]);
// var imgModel = require('./model');
var loggedInID;
app.get("/", function(req, res) {
  res.render("landing-page");
});

app.get("/auth/google",
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

app.get("/auth/google/home",
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // console.log(req.user.id);
    loggedInID=req.user.id;
    // Successful authentication, redirect home.
    console.log("successful authentication!!");
    res.redirect('/home');
  });


app.get("/login", function(req, res) {

  if (req.isAuthenticated()) {
    res.redirect("/home")
  } else {
    res.render("login");
  }
});

app.get("/admin-login", function(req, res) {
  res.render("admin-login");
});

app.get("/signup", function(req, res) {
  res.render("signup");
});

app.get("/upload-book", function(req, res) {
  // console.log("in upload book get!!");
  res.render("upload-book");
});

app.get("/home", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("home");
  } else {
    res.redirect("/login");
  }

});

app.post("/addToShelf",function(req,res){
  console.log(req.body);
  const bookid=req.body.id;
  res.redirect("/bookshelf");
});

app.get("/bookshelf",function(req,res){

  // console.log(loggedInID);
  User.findById(loggedInID,function(err,user){
    if(err){
      console.log(err);
    }
    else{
      // console.log(user.username);
      res.render("display",{title:"No Books Found!",foundBooks:user.books});
    }
  });

});

app.get("/store",function(req,res){
  // console.log(req);
  res.render("store");
});


app.get("/logout", function(req, res) {
  req.logout(function(err) {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/");
});

app.get("/store/:categoryName",function(req,res){
  const categoryName=_.capitalize(req.params.categoryName);
  // console.log(categoryName);
  // res.render("display",{title:"No Books Found!",foundBooks:[]});


  Book.find({category:categoryName},function(err,results){
    if(results.length === 0){     //create new list
      res.render("display",{title:"No Books Found!",foundBooks:[]});
    }
    else{        //show already existing list
      res.render("display",{title:categoryName,foundBooks:results});
    }
  })

});
// app.post("/view-book",function(req,res){
//   const id=req.body.download;
//   // console.log(id);
//
  // Book.findById(id,function(err,book){
  //   if(err){
  //     console.log(err);
  //   }
  //   else{
  //     res.render("show-book",{book:book});
  //   }
  // })

  // Book.find({},function(err,books){
  //   books.forEach(function(book){
  //     console.log("id= "+book.id);
  //       console.log("_id= "+book._id);
  //     console.log(book.name);
  //     console.log("--------------");
  //   })
  // })
  // Book.findOne({id:req.body.download},function(err,results){
  //   if(err){
  //     console.log(err);
  //   }
  //   else{
  //     console.log(results);
  //     // console.log("book name-"+results[0].name);
  //   }
  // })
// });


app.post("/store/displayBook",function(req,res){
  const bookName=_.capitalize(req.body.bookName);
  // console.log(bookName);
  Book.find({name:bookName},function(err,results){
    if(err){
      console.log(err);
    }
    else{
      if(results.length != 0){
        res.render("display",{title:"Found some books in the shelf, I hope you got what you were looking for!",foundBooks:results});
      }
      else{
          res.render("display",{title:"No books found, try searching for another book!",foundBooks:[]});
      }
    }
  })

});

// app.post("/upload-book",
//          upload.fields([{
//            name: 'coverimg', maxCount: 1
//          }, {
//            name: 'file', maxCount: 1
//          }]), function(req, res, next){
//   // ...
// }

app.post("/upload-book", uploadMultiple, (req, res, next) => {
    // console.log(req);
    // console.log(req.files.coverimg[0].filename);
    // if(req.files){
    //   console.log("filesuploaded!");
    //   // console.log(req.files);
    // }

    const obj = new Book({
        name: _.capitalize(req.body.name),
        author:_.capitalize(req.body.author),
        wikiLink: _.capitalize(req.body.wikiLink),
        category:_.capitalize(req.body.category),
        coverimg: {
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.files.coverimg[0].filename)),
            contentType: 'image/png/pdf'
        },
        file: {
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.files.file[0].filename)),
            contentType: 'image/png/pdf'
        }
    });
    // console.log(obj);

    Book.create(obj, (err, item) => {
        if (err) {
            console.log(err);
        }
        else {
          console.log("no error in uploading");
            // item.save();
            res.redirect('/upload-book');
        }
    });

});


app.post("/signup", function(req, res) {
  // console.log(req.body.username);
  // console.log(req.body.password);
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/home");
      });
    }
  });

});

app.post("/admin-login", function(req, res) {
  console.log(req);
  // console.log(req.body.password);
  if(req.body.username === "admin@admin.com" && req.body.password === "password"){
      // console.log("admin !!");
      res.redirect("/upload-book");
  }
  else{
    // console.log("not admin!!");
    res.redirect("/");
  }


});


app.post("/login", function(req, res) {
  // console.log(req._id);
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        console.log(req.user.id);
        loggedInID=req.user.id;
        // console.log(req);
        // console.log("authenticated and redirected to home!!");
        res.redirect("/home");
      });
    }
  });
});



// admin id = 62cec4f559310e34323905af



app.listen(3000, function() {
  console.log("Server started on port 3000");
});
