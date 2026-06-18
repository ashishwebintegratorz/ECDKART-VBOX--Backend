const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function run() {
  await mongoose.connect('mongodb+srv://webintegratorztechnologies_db_user:XOX5iKzSmAJT5ojE@cluster0.jazbe4k.mongodb.net/vegboxDB?appName=Cluster0/&retryWrites=true&w=majority');
  
  const phone = '7008452720';
  const user = await mongoose.connection.collection('users').findOne({ phone: phone });
  
  if (!user) {
    console.log("User not found!");
  } else {
    const pinHash = await bcrypt.hash('1234', 10);
    await mongoose.connection.collection('users').updateOne(
      { phone: phone },
      { $set: { role: 'admin', pinHash: pinHash } }
    );
    console.log("User 7008452720 updated to admin with PIN 1234.");
  }
  
  process.exit(0);
}

run().catch(console.error);
