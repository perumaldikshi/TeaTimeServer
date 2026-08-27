// require('dotenv').config();
// const { Pool } = require('pg');
// const bcrypt = require('bcryptjs');

// //const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// const pool =""
// async function resetAdmin() {
//   try {
//     const newEmail = 'admicomn@teatime.';
//     const newPassword = 'Admin@123';
//     const passwordHash = await bcrypt.hash(newPassword, 10);

//     const res = await pool.query(
//       "UPDATE users SET email = $1, password_hash = $2 WHERE role = 'admin' RETURNING id, email",
//       [newEmail, passwordHash]
//     );

//     if (res.rows.length > 0) {
//       console.log('Admin credentials updated successfully!');
//       console.log('New User ID (Email):', res.rows[0].email);
//       console.log('New Password:', newPassword);
//     } else {
//       console.log('No admin user found to update.');
//     }
//   } catch (err) {
//     console.error(err);
//   } finally {
//     process.exit();
//   }
// }

// resetAdmin();
