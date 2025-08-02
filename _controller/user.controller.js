const {User} = require('../_models') // Importing User model
var bcrypt = require("bcryptjs"); // Importing bcryptjs for password hashing
const { mail, getEmailText} = require('../_mailer/mailer'); // Importing mail and getEmailText from mailer

/**
 * This function lists all the users.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.list = async (req, res) => {
    const users = await User.find({}).populate("roles").select("email club") // Finding all users
    res.status(200).json(users); // Sending response
};

/**
 * This function updates a user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
exports.update = async (req, res) =>{
  let user = await User.findById(req.userId).populate('roles');
  if(user.roles.some((role) => role.name === "admin")){
    user = await User.findById(req.body.id);
  }
  if(user){
    const updateFields = ['password', 'contactInfo', 'club', 'phone', 'getEmails', 'showContact', 'name', 'whatsapp', 'email', 'showInfo', 'showMail'];
    let updateData = {};
    updateFields.forEach(field => {
      if(req.body[field] !== undefined){
        if(field === 'password'){
          updateData[field] = bcrypt.hashSync(req.body[field], 8);
          mail(user.email, "[SPIELEBASAR] Passwort wurde geändert", getEmailText("",`Du erhälst diese Mail da soeben das Passwort für den Spielebasar geändert wurde.<br/><br/>Solltest du dies nicht veranlasst haben, wende dich bitte an problems@srbasar.de.`, false, ""));
        } else {
          updateData[field] = req.body[field];
        }
      }
    });
    await user.updateOne(updateData);
  }
  res.status(204).send("updated");
}