const {User, Role} = require("../_models"); // Importing User and Role models
const randomstring = require("randomstring"); // Importing randomstring for generating random strings
var jwt = require("jsonwebtoken"); // Importing jsonwebtoken for generating tokens
var bcrypt = require("bcryptjs"); // Importing bcryptjs for password hashing
const { mail, getEmailText} = require("../_mailer/mailer"); // Importing mail and getEmailText from mailer

/**
 * This function deletes a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.delete =  async (req, res) => {
     await User.deleteOne({email : req.body.email}) // Deleting the user
   res.json("ok") // Sending response
};

exports.reset= async (req,res) =>{
  const resetToken = randomstring.generate(32);
  const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  const user = await User.findOne({
    email: req.body.email.toLowerCase()
  })
  
  if(user){
    await user.updateOne({
      resetToken: resetToken,
      resetTokenExpires: resetTokenExpires
    })
    
    const resetLink = `${process.env.RESET_PASSWORD_URL}?token=${resetToken}`;
    mail(user.email, "[SPIELEBASAR] Passwort zurücksetzen", getEmailText("", `Du erhälst diese Mail da soeben ein Passwort-Reset für den Spielebasar angefragt wurde.<br/><br>Klicke auf den folgenden Link um dein Passwort zurückzusetzen:<br/><br><a href="${resetLink}">${resetLink}</a><br/><br>Der Link ist 24 Stunden gültig.`, false,""))
  }
  res.json("ok")
}

exports.validateResetToken = async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ 
      valid: false, 
      message: "Token ist erforderlich" 
    });
  }
  
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() }
  });
  
  if (!user) {
    return res.status(200).json({ 
      valid: false, 
      message: "Ungültiger oder abgelaufener Reset-Token" 
    });
  }
  
  res.status(200).json({ 
    valid: true, 
    message: "Token ist gültig",
    email: user.email
  });
}

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() }
  });
  
  if (!user) {
    return res.status(400).json({ message: "Ungültiger oder abgelaufener Reset-Token" });
  }
  
  await user.updateOne({
    password: bcrypt.hashSync(password, 8),
    resetToken: null,
    resetTokenExpires: null
  });
  
  mail(user.email, "[SPIELEBASAR] Passwort wurde geändert", getEmailText("", `Dein Passwort für den Spielebasar wurde erfolgreich geändert.`, false, ""));
  
  const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: 86400
  });
  
  const authorities = [];
  for (let i = 0; i < user.roles.length; i++) {
    authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
  }
  
  res.status(200).send({
    id: user._id,
    username: user.email,
    email: user.email,
    roles: authorities,
    accessToken: accessToken
  });
}

/**
 * This function signs up a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.signup = (req, res) => {
  var pass = randomstring.generate(7); // Generating a new password
  req.body.roles = ['vrsw', 'user'] // Setting roles
 const user = new User({
    email: req.body.email.toLowerCase(), // Setting email
    password: bcrypt.hashSync(pass, 8), // Setting password
    club: req.body.club // Setting club
  });

  mail(user.email, "[SPIELEBASAR] Es wurde ein Account angelegt", getEmailText("",`Es wurde für dich ein Account für  ${user.club.join()} angelegt.<br/><br/>Dein Benutzername ist deine E-Mail-Adresse: ${user.email}<br/><br/>das initiale Passwort: ${pass}`, false,"")) // Sending the email

  // Saving the user
  user.save((err, user) => {
    if (err) {
      res.status(500).send({ message: err }); // Sending error response
      return;
    }

    if (req.body.roles) {
      Role.find(
        {
          name: { $in: req.body.roles }
        },
        (err, roles) => {
          if (err) {
            res.status(500).send({ message: err }); // Sending error response
            return;
          }

          user.roles = roles.map(role => role._id);
          user.save(err => {
            if (err) {
              res.status(500).send({ message: err }); // Sending error response
              return;
            }

            res.send({ message: "User was registered successfully!" }); // Sending success response
          });
        }
      );
    } else {
      Role.findOne({ name: "user" }, (err, role) => {
        if (err) {
          res.status(500).send({ message: err }); // Sending error response
          return;
        }

        user.roles = [role._id];
        user.save(err => {
          if (err) {
            res.status(500).send({ message: err }); // Sending error response
              return;
          }

          res.send({ message: "User was registered successfully!" }); // Sending success response
        });
      });
    }
  });
};

/**
 * This function signs in a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.signin = (req, res) => {
  User.findOne({
    email: req.body.email.toLowerCase() // Finding the user
  })
    .populate("roles", "-__v") // Populating roles
    .exec((err, user) => {
      if (err) {
        res.status(500).send({ message: err }); // Sending error response
        return;
      }

      if (!user) {
        return res.status(404).send({ message: "Benutzer nicht gefunden." }); // Sending error response
      }

      var passwordIsValid = bcrypt.compareSync(
        req.body.password,
        user.password
      ); // Checking if password is valid

      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Passwort falsch!"
        }); // Sending error response
      }

      var token = jwt.sign({ id: user.id }, process.env.SECRET, {
        expiresIn: 86400 // 24 hours
      }); // Generating token

      var authorities = [];

      for (let i = 0; i < user.roles.length; i++) {
        authorities.push("ROLE_" + user.roles[i].name.toUpperCase()); // Adding roles to authorities
      }
      res.status(200).send({
        id: user._id,
        email: user.email,
        roles: authorities,
        club: user.club,
        accessToken: token,
        expireDate: (new Date()).setDate((new Date()).getDate() + 1),
        contactInfo: user.contactInfo,
        phone: user.phone,
        whatsapp: user.whatsapp,
        name: user.name,
        getEmails: user.getEmails,
          showInfo: user.showInfo,
          showMail: user.showMail,
        showContact: user.showContact
      }); // Sending success response
    });
};