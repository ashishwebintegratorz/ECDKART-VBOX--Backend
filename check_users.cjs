const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://webintegratorztechnologies_db_user:XOX5iKzSmAJT5ojE@cluster0.jazbe4k.mongodb.net/vegboxDB?appName=Cluster0/&retryWrites=true&w=majority');
  
  const users = await mongoose.connection.collection('users').find({}).limit(10).toArray();
  console.log("Users:");
  for (let u of users) {
    console.log(`Phone: ${u.phone}, Role: ${u.role}, hasPin: ${!!u.pinHash}`);
  }
  
  const specificUser = await mongoose.connection.collection('users').findOne({ phone: { $regex: /7008452720/ }});
  console.log("Specific User:", specificUser);
  
  process.exit(0);
}

run().catch(console.error);
