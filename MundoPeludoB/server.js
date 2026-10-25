const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'mp_session';
function setSession(res, user) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 8*60*60*1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  res.cookie(SESSION_COOKIE, payload + '.' + sig, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8*60*60*1000, path: '/' });
}
function readSession(req) {
  const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(SESSION_COOKIE + '='));
  if (!value) return null;
  const token = value.slice(SESSION_COOKIE.length + 1);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return data.exp > Date.now() ? data : null;
}

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({limit:"5mb"}));

// Conexión a tu MySQL local (XAMPP)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'veterinaria'
});

db.connect((err) => {
    if (err) {
        console.error('Error al conectar a MySQL:', err);
        return;
    }
    console.log('¡Conectado con éxito a la base de datos veterinaria!');
});

// ==========================================
// 1. RUTA PARA TRAER MASCOTAS (La que ya tenías)
// ==========================================
app.get('/api/mascotas/cliente/:clienteId', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`SELECT m.id_mascota AS id, m.nombre AS name,
      DATE_FORMAT(m.fecha_nac,'%Y-%m-%d') AS fecha_nac, e.tipo_especie AS species,
      r.tipo_raza AS breed, m.agresividad AS aggression, COALESCE(m.observaciones,'') AS observations,
      rel.id_cliente AS clientId FROM mascotas m
      JOIN rel_cliente_mascota rel ON rel.id_mascota=m.id_mascota
      JOIN raza r ON r.id_raza=m.id_raza JOIN especie e ON e.id_especie=r.id_especie
      WHERE rel.id_cliente=? ORDER BY m.id_mascota`, [req.params.clienteId]);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({error:'No se pudieron consultar mascotas'}); }
});

function validBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0,10) === value &&
    date <= new Date() && date.getUTCFullYear() >= 1900;
}

// Registro transaccional: persona + cliente, sin crear mascotas.
app.post('/api/clientes/registrar', async (req, res) => {
    const { fullName, dni, birthDate, email, phone, address, username, password } = req.body;
    if (![fullName, dni, email, phone, username, password].every(v => typeof v === 'string' && v.trim())) {
        return res.status(400).json({ error: 'Completá todos los datos obligatorios.' });
    }
    if (username.length > 25 || password.length > 25 || dni.length > 25) {
        return res.status(400).json({ error: 'Usuario, contraseña y DNI deben tener hasta 25 caracteres.' });
    }
    if (!validBirthDate(birthDate)) return res.status(400).json({error:'Ingresá una fecha de nacimiento válida.'});
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return res.status(400).json({ error: 'Ingresá nombre y apellido.' });
    const nombre = parts.shift();
    const apellido = parts.join(' ');
    if (nombre.length > 25 || apellido.length > 25) return res.status(400).json({ error: 'Nombre o apellido demasiado largo.' });
    const conn = db.promise();
    try {
        const [exists] = await conn.query('SELECT id_clien FROM clientes WHERE usuario = ? LIMIT 1', [username.trim()]);
        if (exists.length) return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
        await conn.beginTransaction();
        // La fecha de nacimiento no se pide en el formulario actual; se agrega como campo pendiente.
        const [person] = await conn.query('INSERT INTO persona (nombre, apellido, dni, fecha_na) VALUES (?, ?, ?, ?)', [nombre, apellido, dni.trim(), birthDate]);
        const [client] = await conn.query('INSERT INTO clientes (id_pers, usuario, `contraseña`, email, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)', [person.insertId, username.trim(), password, email.trim(), phone.trim(), address || '']);
        await conn.commit();
        setSession(res, { username: username.trim(), role: 'client', clientId: client.insertId });
        res.status(201).json({ cliente: { id_clien: client.insertId, usuario: username.trim(), email, telefono: phone, direccion: address || '', nombre, apellido, dni, fecha_na: birthDate } });
    } catch (err) {
        try { await conn.rollback(); } catch (_) {}
        console.error(err);
        res.status(500).json({ error: 'No se pudo registrar el cliente. Revisá la estructura de la base de datos.' });
    }
});

app.get('/api/sesion', async (req, res) => {
  try {
    const user = readSession(req);
    if (!user) return res.status(401).json({error:'Sesión vencida'});
    if (user.role === 'client') {
      const [rows] = await db.promise().query('SELECT id_clien FROM clientes WHERE id_clien=? AND usuario=?', [user.clientId,user.username]);
      if (!rows.length) return res.status(401).json({error:'Usuario inexistente'});
    } else {
      const [rows] = await db.promise().query(`SELECT pe.id_personal FROM personal pe JOIN rol r ON r.id_rol=pe.id_rol
        WHERE pe.id_personal=? AND pe.usuario=? AND LOWER(r.descripcion)=?`, [
        user.staffId,user.username,user.role==='admin'?'administrativo':'veterinario'
      ]);
      if (!rows.length) return res.status(401).json({error:'Usuario inexistente'});
    }
    const {exp,...safeUser} = user;
    res.set('Cache-Control','no-store').json({user:safeUser});
  } catch (e) {console.error(e);res.status(401).json({error:'Sesión inválida'});}
});
app.post('/api/sesion/logout', (_req,res) => {
  res.clearCookie(SESSION_COOKIE,{path:'/',sameSite:'lax'});
  res.json({ok:true});
});

// ==========================================
// 3. NUEVA RUTA: AGREGAR UNA MASCOTA (CORREGIDA)
// ==========================================
app.get('/api/mascotas', async (_req,res) => {
  try {
    const [rows] = await db.promise().query(`SELECT m.id_mascota AS id, m.nombre AS name,
      DATE_FORMAT(m.fecha_nac,'%Y-%m-%d') AS fecha_nac, e.tipo_especie AS species,
      r.tipo_raza AS breed, m.agresividad AS aggression, COALESCE(m.observaciones,'') AS observations,
      rel.id_cliente AS clientId FROM mascotas m
      JOIN rel_cliente_mascota rel ON rel.id_mascota=m.id_mascota
      JOIN raza r ON r.id_raza=m.id_raza JOIN especie e ON e.id_especie=r.id_especie
      ORDER BY m.id_mascota`);
    res.json(rows);
  } catch(e) { console.error(e); res.status(500).json({error:'No se pudieron cargar mascotas'}); }
});
app.post('/api/mascotas/agregar', async (req,res) => {
  const {nombre,fecha_nac,id_raza,id_cliente,agresividad,observaciones}=req.body || {};
  if (!nombre?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_nac||'') || !Number.isInteger(Number(id_raza)) || !Number.isInteger(Number(id_cliente)))
    return res.status(400).json({error:'Completá nombre, fecha de nacimiento, raza y dueño válidos.'});
  const conn=db.promise();
  try {
    await conn.beginTransaction();
    const [valid]=await conn.query('SELECT c.id_clien FROM clientes c WHERE c.id_clien=?',[id_cliente]);
    const [race]=await conn.query('SELECT id_raza FROM raza WHERE id_raza=?',[id_raza]);
    if(!valid.length || !race.length) { await conn.rollback(); return res.status(400).json({error:'Dueño o raza inexistente'}); }
    const [result]=await conn.query('INSERT INTO mascotas(nombre,fecha_nac,id_raza,agresividad,observaciones) VALUES(?,?,?,?,?)',
      [nombre.trim(),fecha_nac,id_raza,agresividad||'Baja',observaciones||'']);
    await conn.query('INSERT INTO rel_cliente_mascota(id_cliente,id_mascota) VALUES(?,?)',[id_cliente,result.insertId]);
    await conn.commit(); res.status(201).json({id_mascota:result.insertId});
  } catch(e) { await conn.rollback(); console.error(e); res.status(500).json({error:'No se pudo guardar la mascota'}); }

});

// ==========================================
// RUTA NUEVA: LOGIN DE CLIENTES
// ==========================================
app.post('/api/clientes/login', (req, res) => {
    const { usuario, contraseña } = req.body;
    if (!usuario || !contraseña) return res.status(400).json({ error: 'Ingresá usuario y contraseña.' });
    const query = `SELECT c.id_clien, c.usuario, c.email, c.telefono, c.direccion,
                          p.nombre, p.apellido, p.dni, DATE_FORMAT(p.fecha_na,'%Y-%m-%d') AS fecha_na
                   FROM clientes c JOIN persona p ON p.id_pers = c.id_pers
                   WHERE c.usuario = ? AND c.\`contraseña\` = ? LIMIT 1`;
    db.query(query, [usuario, contraseña], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al consultar los clientes.' });
        if (!results.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        setSession(res, { username: results[0].usuario, role: 'client', clientId: results[0].id_clien });
        res.json({ cliente: results[0] });
    });
});


// Login del personal: las contraseñas se verifican contra su hash bcrypt.
app.post('/api/personal/login', async (req, res) => {
    const { usuario, contraseña } = req.body || {};
    if (typeof usuario !== 'string' || typeof contraseña !== 'string' || !usuario.trim() || !contraseña) {
        return res.status(400).json({ error: 'Ingresá usuario y contraseña.' });
    }
    try {
        const [rows] = await db.promise().query(
            `SELECT pe.id_personal, pe.usuario, pe.password_hash, p.nombre, p.apellido, p.dni, p.fecha_na, r.descripcion AS rol
             FROM personal pe JOIN persona p ON p.id_pers = pe.id_pers JOIN rol r ON r.id_rol = pe.id_rol
             WHERE pe.usuario = ? LIMIT 1`, [usuario.trim()]
        );
        if (!rows.length || !rows[0].password_hash ||
            !(await bcrypt.compare(contraseña, rows[0].password_hash))) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }
        const rol = rows[0].rol.trim().toLowerCase();
        if (!['administrativo', 'veterinario'].includes(rol)) {
            return res.status(403).json({ error: 'El usuario no tiene un rol habilitado.' });
        }
        setSession(res, {
          username: rows[0].usuario, role: rol === 'administrativo' ? 'admin' : 'vet',
          fullName: `${rows[0].nombre} ${rows[0].apellido}`.trim(),
          dni: rows[0].dni, birthDate: rows[0].fecha_na, staffId: rows[0].id_personal
        });
        return res.json({ personal: {
            id_personal: rows[0].id_personal,
            usuario: rows[0].usuario,
            nombre: rows[0].nombre, apellido: rows[0].apellido, dni: rows[0].dni, fecha_na: rows[0].fecha_na,
            role: rol === 'administrativo' ? 'admin' : 'vet'
        } });
    } catch (error) {
        console.error('Error al iniciar sesión de personal:', error);
        return res.status(500).json({ error: 'No se pudo consultar el personal.' });
    }
});

// Edición transaccional de persona y cliente.
app.put('/api/clientes/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { fullName, dni, birthDate, email, phone, address, username, password } = req.body;
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido.' });
    if (![fullName, dni, email, phone, address, username].every(v => typeof v === 'string' && v.trim())) return res.status(400).json({ error: 'Completá todos los campos obligatorios.' });
    if (!validBirthDate(birthDate)) return res.status(400).json({error:'Ingresá una fecha de nacimiento válida.'});
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return res.status(400).json({ error: 'Ingresá nombre y apellido.' });
    const nombre = parts.shift(), apellido = parts.join(' ');
    if ([nombre, apellido, dni, username].some(v => v.length > 25) || (password && password.length > 25)) return res.status(400).json({ error: 'Uno de los campos supera los 25 caracteres.' });
    const conn = db.promise();
    try {
        await conn.beginTransaction();
        const [found] = await conn.query('SELECT id_pers FROM clientes WHERE id_clien = ? FOR UPDATE', [id]);
        if (!found.length) { await conn.rollback(); return res.status(404).json({ error: 'Cliente inexistente.' }); }
        const [duplicate] = await conn.query('SELECT id_clien FROM clientes WHERE usuario = ? AND id_clien <> ? LIMIT 1', [username.trim(), id]);
        if (duplicate.length) { await conn.rollback(); return res.status(409).json({ error: 'El usuario ya está en uso.' }); }
        await conn.query('UPDATE persona SET nombre = ?, apellido = ?, dni = ?, fecha_na = ? WHERE id_pers = ?', [nombre, apellido, dni.trim(), birthDate, found[0].id_pers]);
        if (typeof password === 'string' && password.length) {
            await conn.query('UPDATE clientes SET usuario = ?, email = ?, telefono = ?, direccion = ?, `contraseña` = ? WHERE id_clien = ?', [username.trim(), email.trim(), phone.trim(), address.trim(), password, id]);
        } else {
            await conn.query('UPDATE clientes SET usuario = ?, email = ?, telefono = ?, direccion = ? WHERE id_clien = ?', [username.trim(), email.trim(), phone.trim(), address.trim(), id]);
        }
        await conn.commit();
        res.json({ cliente: { fecha_na: birthDate, id_clien: id, nombre, apellido, dni: dni.trim(), usuario: username.trim(), email: email.trim(), telefono: phone.trim(), direccion: address.trim() } });
    } catch (err) { try { await conn.rollback(); } catch (_) {} console.error(err); res.status(500).json({ error: 'No se pudo actualizar el cliente.' }); }
});

app.put('/api/clientes/:id/password', async (req, res) => {
    const id = Number(req.params.id);
    const { currentPassword, newPassword } = req.body;
    if (!Number.isInteger(id) || id < 1 || typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 25) return res.status(400).json({ error: 'Datos de contraseña inválidos.' });
    db.query('UPDATE clientes SET `contraseña` = ? WHERE id_clien = ? AND `contraseña` = ?', [newPassword, id, currentPassword], (err, result) => {
        if (err) return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
        if (!result.affectedRows) return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
        res.json({ ok: true });
    });
});

app.get('/api/clientes', (req, res) => {
    db.query("SELECT c.id_clien, c.usuario, c.email, c.telefono, c.direccion, p.nombre, p.apellido, p.dni, DATE_FORMAT(p.fecha_na,'%Y-%m-%d') AS fecha_na FROM clientes c JOIN persona p ON p.id_pers = c.id_pers", (err, rows) => {
        if (err) return res.status(500).json({ error: 'No se pudo listar clientes.' });
        res.json({ clientes: rows });
    });
});


app.get('/api/historias', async (_req,res) => {
  try {
    const [rows]=await db.promise().query(`SELECT h.id_historia AS id, DATE_FORMAT(h.fecha,'%Y-%m-%d') AS date,
      h.id_mascota AS petId, m.nombre AS petName, CONCAT(p.nombre,' ',p.apellido) AS veterinarian,
      h.anotacion AS notes, COALESCE(s.descripcion,'Consulta') AS service,
      COALESCE(CONCAT(du.nombre,' ',du.apellido),'') AS owner
      FROM \`historia clinica\` h JOIN mascotas m ON m.id_mascota=h.id_mascota
      JOIN personal pe ON pe.id_personal=h.id_personal JOIN persona p ON p.id_pers=pe.id_pers
      LEFT JOIN servicio s ON s.id_servicio=h.id_servicio
      LEFT JOIN rel_cliente_mascota rel ON rel.id_mascota=m.id_mascota
      LEFT JOIN clientes c ON c.id_clien=rel.id_cliente LEFT JOIN persona du ON du.id_pers=c.id_pers
      ORDER BY h.fecha DESC,h.id_historia DESC`);
    res.json(rows);
  } catch(e) {console.error(e);res.status(500).json({error:'No se pudieron consultar historias'});}
});
app.post('/api/historias', async (req,res) => {
  const {id_mascota,usuario_veterinario,id_servicio,anotacion}=req.body||{};
  if(!Number(id_mascota)||!usuario_veterinario||!Number(id_servicio)||!anotacion?.trim()) return res.status(400).json({error:'Datos incompletos'});
  try {
    const [v]=await db.promise().query(`SELECT pe.id_personal FROM personal pe JOIN rol r ON r.id_rol=pe.id_rol WHERE pe.usuario=? AND LOWER(r.descripcion)='veterinario'`,[usuario_veterinario]);
    if(!v.length) return res.status(400).json({error:'Veterinario no encontrado'});
    const [result]=await db.promise().query('INSERT INTO `historia clinica`(id_mascota,id_personal,fecha,anotacion,id_servicio) VALUES(?,?,CURDATE(),?,?)',
      [id_mascota,v[0].id_personal,anotacion.trim(),id_servicio]);
    res.status(201).json({id:result.insertId});
  } catch(e) {console.error(e);res.status(500).json({error:'No se pudo guardar la historia'});}
});
// Edición de historia clínica: mantiene un registro de auditoría en MySQL.

app.put('/api/historias/:id', async (req, res) => {
  const id = Number(req.params.id);

  const {
    usuario_veterinario,
    id_servicio,
    anotacion
  } = req.body || {};

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(Number(id_servicio)) ||
    Number(id_servicio) <= 0 ||
    typeof anotacion !== 'string' ||
    !anotacion.trim() ||
    anotacion.trim().length > 10000 ||
    typeof usuario_veterinario !== 'string' ||
    !usuario_veterinario.trim()
  ) {
    return res.status(400).json({
      error: 'Datos de edición inválidos'
    });
  }

  // Utilizamos la conexión existente de MySQL.
  const conn = db.promise();
  let transaccionIniciada = false;

  try {
    await conn.beginTransaction();
    transaccionIniciada = true;

    // Verificar que el usuario sea veterinario.
    const [veterinarios] = await conn.query(`
      SELECT pe.id_personal
      FROM personal pe
      JOIN rol r ON r.id_rol = pe.id_rol
      WHERE pe.usuario = ?
        AND LOWER(r.descripcion) = 'veterinario'
    `, [usuario_veterinario]);

    if (!veterinarios.length) {
      await conn.rollback();
      transaccionIniciada = false;

      return res.status(403).json({
        error: 'Solo veterinarios pueden editar historias'
      });
    }

    // Obtener la historia clínica original.
    const [historias] = await conn.query(`
      SELECT id_historia, id_servicio, anotacion
      FROM \`historia clinica\`
      WHERE id_historia = ?
      FOR UPDATE
    `, [id]);

    if (!historias.length) {
      await conn.rollback();
      transaccionIniciada = false;

      return res.status(404).json({
        error: 'Historia clínica no encontrada'
      });
    }

    // Verificar el servicio.
    const [servicios] = await conn.query(`
      SELECT id_servicio
      FROM servicio
      WHERE id_servicio = ?
    `, [id_servicio]);

    if (!servicios.length) {
      await conn.rollback();
      transaccionIniciada = false;

      return res.status(400).json({
        error: 'Servicio inexistente'
      });
    }

    const anterior = historias[0];

    // Guardar la versión anterior en auditoría.
    await conn.query(`
      INSERT INTO historia_clinica_auditoria
      (
        id_historia,
        id_personal_editor,
        id_servicio_anterior,
        anotacion_anterior
      )
      VALUES (?, ?, ?, ?)
    `, [
      id,
      veterinarios[0].id_personal,
      anterior.id_servicio,
      anterior.anotacion
    ]);

    // Actualizar la historia clínica.
    await conn.query(`
      UPDATE \`historia clinica\`
      SET id_servicio = ?, anotacion = ?
      WHERE id_historia = ?
    `, [
      id_servicio,
      anotacion.trim(),
      id
    ]);

    await conn.commit();
    transaccionIniciada = false;

    return res.json({
      ok: true,
      id,
      mensaje: 'Historia clínica actualizada correctamente'
    });

  } catch (error) {
    if (transaccionIniciada) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error('Error al revertir:', rollbackError);
      }
    }

    console.error('Error al editar historia clínica:', error);

    return res.status(500).json({
      error: 'No se pudo editar la historia clínica'
    });
  }
});
app.get('/api/turnos', async (req,res) => {
  try {
    const params=[]; let where="WHERE t.estado='activo'";
    if(req.query.fecha && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)) {where+=' AND DATE(t.fecha_hora)=?';params.push(req.query.fecha);}
    const [rows]=await db.promise().query(`SELECT t.id_turno AS id, t.id_mascota AS petId, t.id_servicio AS serviceId,
      DATE_FORMAT(t.fecha_hora,'%Y-%m-%d') AS date, DATE_FORMAT(t.fecha_hora,'%H:%i') AS time,
      COALESCE(t.motivo,'') AS notes, t.estado AS status, m.nombre AS pet, s.descripcion AS service, s.duracion_minutos AS duration,
      CONCAT(p.nombre,' ',p.apellido) AS client
      FROM turnos t JOIN mascotas m ON m.id_mascota=t.id_mascota
      JOIN servicio s ON s.id_servicio=t.id_servicio
      LEFT JOIN rel_cliente_mascota rel ON rel.id_mascota=m.id_mascota
      LEFT JOIN clientes c ON c.id_clien=rel.id_cliente LEFT JOIN persona p ON p.id_pers=c.id_pers
      ${where} ORDER BY t.fecha_hora`,params);
    res.json(rows);
  } catch(e){console.error(e);res.status(500).json({error:'No se pudieron cargar turnos'});}
});
app.post('/api/turnos', async(req,res)=>{
  const {id_mascota,id_servicio,fecha,hora,motivo}=req.body||{};
  if(!Number(id_mascota)||!Number(id_servicio)||!/^\d{4}-\d{2}-\d{2}$/.test(fecha||'')||!/^\d{2}:\d{2}$/.test(hora||''))
    return res.status(400).json({error:'Datos de turno inválidos'});
  const start=`${fecha} ${hora}:00`;
  const conn=db.promise();
  try {
    await conn.beginTransaction();
    // Bloqueo serializado: evita dos reservas simultáneas sobre el mismo horario.
    await conn.query('SELECT id_servicio FROM servicio ORDER BY id_servicio FOR UPDATE');
    const [services]=await conn.query('SELECT duracion_minutos FROM servicio WHERE id_servicio=?',[id_servicio]);
    const duration=Number(services[0]?.duracion_minutos);
    if(!Number.isInteger(duration)||duration<=0) {await conn.rollback();return res.status(400).json({error:'Servicio sin duración válida'});}
    const [pets]=await conn.query('SELECT id_mascota FROM mascotas WHERE id_mascota=?',[id_mascota]);
    if(!pets.length) {await conn.rollback();return res.status(400).json({error:'Mascota inexistente'});}
    const [holiday]=await conn.query('SELECT id_feriado FROM feriados WHERE dia_mes=?',[`${fecha.slice(8,10)}-${fecha.slice(5,7)}`]);
    if(holiday.length) {await conn.rollback();return res.status(409).json({error:'No se reservan turnos en feriados fijos'});}
    const [conflicts]=await conn.query(`SELECT t.id_turno FROM turnos t JOIN servicio s ON s.id_servicio=t.id_servicio
      WHERE t.estado='activo' AND t.fecha_hora < DATE_ADD(?,INTERVAL ? MINUTE)
        AND DATE_ADD(t.fecha_hora,INTERVAL s.duracion_minutos MINUTE) > ?
        AND (LOWER(TRIM(s.descripcion)) IN ('baño','bano')) =
            (SELECT LOWER(TRIM(descripcion)) IN ('baño','bano') FROM servicio WHERE id_servicio = ?)
      LIMIT 1`,[start,duration,start,id_servicio]);
    if(conflicts.length) {await conn.rollback();return res.status(409).json({error:'El horario se superpone con otro turno'});}
    const [result] = await conn.query('INSERT INTO turnos(fecha_hora,id_mascota,id_servicio,motivo) VALUES(?,?,?,?)',
  [start, id_mascota, id_servicio, motivo||'']);
    await conn.commit();res.status(201).json({id:result.insertId});
  }catch(e){await conn.rollback();console.error(e);res.status(500).json({error:'No se pudo guardar el turno'});}

});


// Cancelación lógica: se conserva el turno para trazabilidad.
app.patch('/api/turnos/:id/cancelar', async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'ID inválido'});
  try{
    const [result]=await db.promise().query("UPDATE turnos SET estado='cancelado' WHERE id_turno=? AND estado='activo'",[id]);
    if(!result.affectedRows)return res.status(404).json({error:'Turno inexistente o ya cancelado'});
    return res.json({ok:true});
  }catch(e){console.error(e);return res.status(500).json({error:'No se pudo cancelar el turno'});}
});

// Reprogramación con la misma regla de dos agendas que la creación.
app.patch('/api/turnos/:id/reprogramar',async(req,res)=>{
  const id=Number(req.params.id);
  const {fecha,hora}=req.body||{};
  if(!Number.isInteger(id)||id<=0||typeof fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||
     typeof hora!=='string'||!/^\d{2}:\d{2}$/.test(hora))
    return res.status(400).json({error:'Fecha u hora inválida'});
  const inicio=`${fecha} ${hora}:00`;
  const conn=db.promise();let transaction=false;
  try{
    await conn.beginTransaction();transaction=true;
    await conn.query('SELECT id_servicio FROM servicio ORDER BY id_servicio FOR UPDATE');
    const [turnos]=await conn.query(`SELECT t.id_turno,t.id_servicio,s.duracion_minutos FROM turnos t
      JOIN servicio s ON s.id_servicio=t.id_servicio WHERE t.id_turno=? AND t.estado='activo' FOR UPDATE`,[id]);
    if(!turnos.length){await conn.rollback();transaction=false;return res.status(404).json({error:'Turno inexistente o cancelado'});}
    const duracion=Number(turnos[0].duracion_minutos);
    if(!Number.isInteger(duracion)||duracion<=0){await conn.rollback();transaction=false;return res.status(400).json({error:'Duración inválida'});}
    const [feriados]=await conn.query('SELECT id_feriado FROM feriados WHERE dia_mes=?',[`${fecha.slice(8,10)}-${fecha.slice(5,7)}`]);
    if(feriados.length){await conn.rollback();transaction=false;return res.status(409).json({error:'No se reservan turnos en feriados fijos'});}
    const [conflictos]=await conn.query(`SELECT t.id_turno FROM turnos t JOIN servicio s ON s.id_servicio=t.id_servicio
      WHERE t.estado='activo' AND t.id_turno<>? AND t.fecha_hora < DATE_ADD(?,INTERVAL ? MINUTE)
        AND DATE_ADD(t.fecha_hora,INTERVAL s.duracion_minutos MINUTE)>?
        AND (LOWER(TRIM(s.descripcion)) IN ('baño','bano')) =
            (SELECT LOWER(TRIM(descripcion)) IN ('baño','bano') FROM servicio WHERE id_servicio=?)
      LIMIT 1`,[id,inicio,duracion,inicio,turnos[0].id_servicio]);
    if(conflictos.length){await conn.rollback();transaction=false;return res.status(409).json({error:'El horario se superpone con otro turno'});}
    await conn.query('UPDATE turnos SET fecha_hora=? WHERE id_turno=?',[inicio,id]);
    await conn.commit();transaction=false;return res.json({ok:true});
  }catch(e){if(transaction)try{await conn.rollback();}catch(err){console.error(err)}console.error(e);return res.status(500).json({error:'No se pudo reprogramar el turno'});}
});


// Cancelación lógica: se conserva el turno para trazabilidad.
app.patch('/api/turnos/:id/cancelar', async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'ID inválido'});
  try{
    const [result]=await db.promise().query("UPDATE turnos SET estado='cancelado' WHERE id_turno=? AND estado='activo'",[id]);
    if(!result.affectedRows)return res.status(404).json({error:'Turno inexistente o ya cancelado'});
    return res.json({ok:true});
  }catch(e){console.error(e);return res.status(500).json({error:'No se pudo cancelar el turno'});}
});

// Reprogramación con la misma regla de dos agendas que la creación.
app.patch('/api/turnos/:id/reprogramar',async(req,res)=>{
  const id=Number(req.params.id);
  const {fecha,hora}=req.body||{};
  if(!Number.isInteger(id)||id<=0||typeof fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||
     typeof hora!=='string'||!/^\d{2}:\d{2}$/.test(hora))
    return res.status(400).json({error:'Fecha u hora inválida'});
  const inicio=`${fecha} ${hora}:00`;
  const conn=db.promise();let transaction=false;
  try{
    await conn.beginTransaction();transaction=true;
    await conn.query('SELECT id_servicio FROM servicio ORDER BY id_servicio FOR UPDATE');
    const [turnos]=await conn.query(`SELECT t.id_turno,t.id_servicio,s.duracion_minutos FROM turnos t
      JOIN servicio s ON s.id_servicio=t.id_servicio WHERE t.id_turno=? AND t.estado='activo' FOR UPDATE`,[id]);
    if(!turnos.length){await conn.rollback();transaction=false;return res.status(404).json({error:'Turno inexistente o cancelado'});}
    const duracion=Number(turnos[0].duracion_minutos);
    if(!Number.isInteger(duracion)||duracion<=0){await conn.rollback();transaction=false;return res.status(400).json({error:'Duración inválida'});}
    const [feriados]=await conn.query('SELECT id_feriado FROM feriados WHERE dia_mes=?',[`${fecha.slice(8,10)}-${fecha.slice(5,7)}`]);
    if(feriados.length){await conn.rollback();transaction=false;return res.status(409).json({error:'No se reservan turnos en feriados fijos'});}
    const [conflictos]=await conn.query(`SELECT t.id_turno FROM turnos t JOIN servicio s ON s.id_servicio=t.id_servicio
      WHERE t.estado='activo' AND t.id_turno<>? AND t.fecha_hora < DATE_ADD(?,INTERVAL ? MINUTE)
        AND DATE_ADD(t.fecha_hora,INTERVAL s.duracion_minutos MINUTE)>?
        AND (LOWER(TRIM(s.descripcion)) IN ('baño','bano')) =
            (SELECT LOWER(TRIM(descripcion)) IN ('baño','bano') FROM servicio WHERE id_servicio=?)
      LIMIT 1`,[id,inicio,duracion,inicio,turnos[0].id_servicio]);
    if(conflictos.length){await conn.rollback();transaction=false;return res.status(409).json({error:'El horario se superpone con otro turno'});}
    await conn.query('UPDATE turnos SET fecha_hora=? WHERE id_turno=?',[inicio,id]);
    await conn.commit();transaction=false;return res.json({ok:true});
  }catch(e){if(transaction)try{await conn.rollback();}catch(err){console.error(err)}console.error(e);return res.status(500).json({error:'No se pudo reprogramar el turno'});}
});


// Cancelación lógica: se conserva el turno para trazabilidad.
app.patch('/api/turnos/:id/cancelar', async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'ID inválido'});
  try{
    const [result]=await db.promise().query("UPDATE turnos SET estado='cancelado' WHERE id_turno=? AND estado='activo'",[id]);
    if(!result.affectedRows)return res.status(404).json({error:'Turno inexistente o ya cancelado'});
    return res.json({ok:true});
  }catch(e){console.error(e);return res.status(500).json({error:'No se pudo cancelar el turno'});}
});

// Reprogramación con la misma regla de dos agendas que la creación.
app.patch('/api/turnos/:id/reprogramar',async(req,res)=>{
  const id=Number(req.params.id);
  const {fecha,hora}=req.body||{};
  if(!Number.isInteger(id)||id<=0||typeof fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||
     typeof hora!=='string'||!/^\d{2}:\d{2}$/.test(hora))
    return res.status(400).json({error:'Fecha u hora inválida'});
  const inicio=`${fecha} ${hora}:00`;
  const conn=db.promise();let transaction=false;
  try{
    await conn.beginTransaction();transaction=true;
    await conn.query('SELECT id_servicio FROM servicio ORDER BY id_servicio FOR UPDATE');
    const [turnos]=await conn.query(`SELECT t.id_turno,t.id_servicio,s.duracion_minutos FROM turnos t
      JOIN servicio s ON s.id_servicio=t.id_servicio WHERE t.id_turno=? AND t.estado='activo' FOR UPDATE`,[id]);
    if(!turnos.length){await conn.rollback();transaction=false;return res.status(404).json({error:'Turno inexistente o cancelado'});}
    const duracion=Number(turnos[0].duracion_minutos);
    if(!Number.isInteger(duracion)||duracion<=0){await conn.rollback();transaction=false;return res.status(400).json({error:'Duración inválida'});}
    const [feriados]=await conn.query('SELECT id_feriado FROM feriados WHERE dia_mes=?',[`${fecha.slice(8,10)}-${fecha.slice(5,7)}`]);
    if(feriados.length){await conn.rollback();transaction=false;return res.status(409).json({error:'No se reservan turnos en feriados fijos'});}
    const [conflictos]=await conn.query(`SELECT t.id_turno FROM turnos t JOIN servicio s ON s.id_servicio=t.id_servicio
      WHERE t.estado='activo' AND t.id_turno<>? AND t.fecha_hora < DATE_ADD(?,INTERVAL ? MINUTE)
        AND DATE_ADD(t.fecha_hora,INTERVAL s.duracion_minutos MINUTE)>?
        AND (LOWER(TRIM(s.descripcion)) IN ('baño','bano')) =
            (SELECT LOWER(TRIM(descripcion)) IN ('baño','bano') FROM servicio WHERE id_servicio=?)
      LIMIT 1`,[id,inicio,duracion,inicio,turnos[0].id_servicio]);
    if(conflictos.length){await conn.rollback();transaction=false;return res.status(409).json({error:'El horario se superpone con otro turno'});}
    await conn.query('UPDATE turnos SET fecha_hora=? WHERE id_turno=?',[inicio,id]);
    await conn.commit();transaction=false;return res.json({ok:true});
  }catch(e){if(transaction)try{await conn.rollback();}catch(err){console.error(err)}console.error(e);return res.status(500).json({error:'No se pudo reprogramar el turno'});}
});


// Imagen de producto almacenada en MySQL, con límite de 2 MB.
function decodeProductImage(data) {
  if (data === undefined || data === null || data === '') return null;
  if (typeof data !== 'string') throw new Error('Imagen inválida');
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) throw new Error('Solo se permiten imágenes JPG, PNG o WebP');
  const bytes=Buffer.from(match[2],'base64');
  if (!bytes.length || bytes.length>2*1024*1024) throw new Error('La imagen debe pesar entre 1 byte y 2 MB');
  const valid=match[1]==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1]==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
    : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
  if (!valid) throw new Error('El contenido no coincide con el formato de imagen');
  return {bytes,mime:match[1]};
}
app.get('/api/productos/:id/imagen',async(req,res)=>{
  try {
    const [rows]=await db.promise().query('SELECT imagen_datos,imagen_mime FROM producto WHERE id_prod=?',[req.params.id]);
    if(!rows.length || !rows[0].imagen_datos)return res.status(404).end();
    res.set('Content-Type',rows[0].imagen_mime||'application/octet-stream');
    res.set('Cache-Control','no-store');
    res.send(rows[0].imagen_datos);
  }catch(e){console.error(e);res.status(500).end();}
});
app.get('/api/productos', async(_req,res)=>{
  try{
    const [rows]=await db.promise().query(`SELECT p.id_prod AS id,p.nombre AS name,p.precio AS price,
      p.stock AS stock,c.descripcion AS category,COALESCE(p.descripcion,'') AS description,
      CASE WHEN p.imagen_datos IS NOT NULL THEN CONCAT('http://localhost:3000/api/productos/',p.id_prod,'/imagen') ELSE '' END AS imageUrl FROM producto p JOIN categoria c ON c.id_categoria=p.id_categoria ORDER BY p.id_prod`);
    res.json(rows);
  }catch(e){console.error(e);res.status(500).json({error:'No se pudieron cargar productos'});}
});
app.post('/api/productos', async(req,res)=>{
  const {name,price,stock,category,description,imageData}=req.body||{};
  if(!name?.trim()||name.length>25||!Number.isFinite(Number(price))||Number(price)<0||!Number.isInteger(Number(stock))||Number(stock)<0)
    return res.status(400).json({error:'Datos del producto inválidos'});
  try{
    const uploaded=decodeProductImage(imageData);
    const [r]=await db.promise().query('INSERT INTO producto(nombre,precio,stock,codigo,categoria,id_categoria,descripcion,imagen_datos,imagen_mime) SELECT ?,?,?,?,?,id_categoria,?,?,? FROM categoria WHERE descripcion=?',
      [name.trim(),price,Number(stock),`MP-${Date.now()}`,category||'Alimento',description||'',uploaded?.bytes||null,uploaded?.mime||null,category||'Alimento']);
    if(!r.affectedRows)return res.status(400).json({error:'Categoría inexistente'});
    res.status(201).json({id:r.insertId});
  }catch(e){console.error(e);res.status(500).json({error:e.message||'No se pudo guardar el producto'});}
});
app.put('/api/productos/:id', async(req,res)=>{
  const {name,price,stock,category,description,imageData}=req.body||{};
  if(!name?.trim()||name.length>25||!Number.isFinite(Number(price))||Number(price)<0||!Number.isInteger(Number(stock))||Number(stock)<0)
    return res.status(400).json({error:'Datos del producto inválidos'});
  try{
    const uploaded=decodeProductImage(imageData);
    const [r]=await db.promise().query(`UPDATE producto SET nombre=?,precio=?,stock=?,categoria=?,id_categoria=(SELECT id_categoria FROM categoria WHERE descripcion=?),descripcion=?
      ${uploaded?',imagen_datos=?,imagen_mime=?':''} WHERE id_prod=?`,
      [name.trim(),price,Number(stock),category||'Alimento',category||'Alimento',description||'',...(uploaded?[uploaded.bytes,uploaded.mime]:[]),req.params.id]);
    if(!r.affectedRows)return res.status(404).json({error:'Producto inexistente'});
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({error:e.message||'No se pudo actualizar el producto'});}
});
app.delete('/api/productos/:id', async(req,res)=>{
  try{
    const [r]=await db.promise().query('DELETE FROM producto WHERE id_prod=?',[req.params.id]);
    if(!r.affectedRows)return res.status(404).json({error:'Producto inexistente'});
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({error:'No se pudo eliminar el producto'});}
});

const salesPool = mysql.createPool({host:'localhost',user:'root',password:'',database:'veterinaria',waitForConnections:true,connectionLimit:5});

// ============================================================
// VENTAS: confirmacion, historial y entrega
// ============================================================
function sessionForRole(req, res, role) {
  let session;
  try { session = readSession(req); } catch (_) { session = null; }
  if (!session) { res.status(401).json({error:'Iniciá sesión para continuar'}); return null; }
  if (session.role !== role || (role === 'client' && !Number.isInteger(Number(session.clientId))) ||
      (role === 'admin' && !Number.isInteger(Number(session.staffId)))) {
    res.status(403).json({error:'No tenés permisos para realizar esta operación'});
    return null;
  }
  return session;
}

async function loadSaleDetails(connection, sales) {
  if (!sales.length) return [];
  const ids = sales.map(s => s.id);
  const [details] = await connection.query(`SELECT d.id_venta AS saleId, d.id_producto AS productId,
    p.nombre AS name, d.cantidad AS quantity, d.precio_unitario AS unitPrice,
    (d.cantidad * d.precio_unitario) AS subtotal
    FROM detalle_venta d JOIN producto p ON p.id_prod=d.id_producto
    WHERE d.id_venta IN (?) ORDER BY d.id_detalle`, [ids]);
  const bySale = new Map();
  for (const d of details) {
    if (!bySale.has(d.saleId)) bySale.set(d.saleId, []);
    bySale.get(d.saleId).push(d);
  }
  return sales.map(s => ({...s, items:bySale.get(s.id)||[]}));
}

// Body: {items:[{productId,quantity}], deliveryType:'registered'|'other'|'pickup',
//        deliveryAddress?:string, deliveryInstructions?:string}
app.post('/api/ventas', async (req,res) => {
  const user = sessionForRole(req,res,'client');
  if (!user) return;
  const {items,deliveryType,deliveryAddress,deliveryInstructions} = req.body || {};
  if (!Array.isArray(items) || items.length===0 || items.length>100 ||
      !items.every(i => i && Number.isSafeInteger(i.productId) && i.productId>0 &&
        Number.isSafeInteger(i.quantity) && i.quantity>0 && i.quantity<=10000) ||
      new Set(items.map(i=>i.productId)).size!==items.length) {
    return res.status(400).json({error:'El carrito contiene productos o cantidades inválidas'});
  }
  if (!['registered','other','pickup'].includes(deliveryType) ||
      (deliveryAddress!==undefined && typeof deliveryAddress!=='string') ||
      (deliveryInstructions!==undefined && typeof deliveryInstructions!=='string') ||
      (deliveryAddress?.length||0)>255 || (deliveryInstructions?.length||0)>2000) {
    return res.status(400).json({error:'Datos de entrega inválidos'});
  }
  if (deliveryType==='other' && !deliveryAddress?.trim()) {
    return res.status(400).json({error:'Ingresá la dirección de entrega'});
  }
  const conn = await salesPool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const [clients] = await conn.query('SELECT id_clien, direccion FROM clientes WHERE id_clien=? AND usuario=?',
      [user.clientId,user.username]);
    if (!clients.length) { await conn.rollback(); return res.status(401).json({error:'Cliente inexistente'}); }
    const isDelivery = deliveryType!=='pickup';
    const address = !isDelivery ? null : deliveryType==='registered' ? clients[0].direccion?.trim() : deliveryAddress.trim();
    if (isDelivery && !address) { await conn.rollback(); return res.status(400).json({error:'No hay una dirección válida para el envío'}); }
    const instructions = isDelivery ? (deliveryInstructions?.trim()||null) : null;
    let totalCents = 0;
    const detail = [];
    // Bloqueo en orden estable para minimizar conflictos entre compras simultáneas.
    for (const item of [...items].sort((a,b)=>a.productId-b.productId)) {
      const [products] = await conn.query('SELECT id_prod,nombre,precio,stock FROM producto WHERE id_prod=? FOR UPDATE',[item.productId]);
      if (!products.length) { await conn.rollback(); return res.status(409).json({error:`El producto ${item.productId} ya no existe`}); }
      const p=products[0];
      if (Number(p.stock)<item.quantity) { await conn.rollback(); return res.status(409).json({error:`Stock insuficiente para ${p.nombre}. Disponibles: ${p.stock}`}); }
      const priceCents = Math.round(Number(p.precio)*100);
      if (!Number.isSafeInteger(priceCents) || priceCents<0) throw new Error('Precio de producto inválido');
      totalCents += priceCents*item.quantity;
      if (!Number.isSafeInteger(totalCents)) throw new Error('Total fuera de rango');
      detail.push({id:p.id_prod,quantity:item.quantity,unitPrice:(priceCents/100).toFixed(2)});
    }
    if (totalCents>999999999999) { await conn.rollback(); return res.status(400).json({error:'El total supera el máximo permitido'}); }
    const [sale] = await conn.query(`INSERT INTO venta
      (id_cliente,precio_total,entregado,envio,direccion_entrega,instrucciones_entrega)
      VALUES(?,?,0,?,?,?)`, [user.clientId,(totalCents/100).toFixed(2),isDelivery?1:0,address,instructions]);
    for (const d of detail) {
      await conn.query('INSERT INTO detalle_venta(id_venta,id_producto,cantidad,precio_unitario) VALUES(?,?,?,?)',
        [sale.insertId,d.id,d.quantity,d.unitPrice]);
      await conn.query('UPDATE producto SET stock=stock-? WHERE id_prod=?',[d.quantity,d.id]);
    }
    await conn.commit();
    res.status(201).json({id:sale.insertId,total:(totalCents/100).toFixed(2),message:'Pedido registrado correctamente'});
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Error al confirmar venta:',e);
    res.status(500).json({error:'No se pudo registrar la compra'});
  } finally { conn.release(); }
});

app.get('/api/ventas/mis-compras', async(req,res)=>{
  const user=sessionForRole(req,res,'client');
  if (!user) return;
  try {
    const [sales]=await db.promise().query(`SELECT v.id_venta AS id,DATE_FORMAT(v.fecha,'%Y-%m-%d %H:%i:%s') AS date,
      v.precio_total AS total,v.entregado AS delivered,v.envio AS shipping,
      v.direccion_entrega AS deliveryAddress,v.instrucciones_entrega AS deliveryInstructions
      FROM venta v JOIN clientes c ON c.id_clien=v.id_cliente
      WHERE v.id_cliente=? AND c.usuario=? ORDER BY v.fecha DESC,v.id_venta DESC`,[user.clientId,user.username]);
    res.json(await loadSaleDetails(db.promise(),sales));
  } catch(e) { console.error(e);res.status(500).json({error:'No se pudieron consultar tus compras'}); }
});

app.get('/api/ventas',async(req,res)=>{
  const user=sessionForRole(req,res,'admin');
  if (!user) return;
  try {
    const [sales]=await db.promise().query(`SELECT v.id_venta AS id,v.id_cliente AS clientId,
      CONCAT(p.nombre,' ',p.apellido) AS clientName,c.usuario AS username,
      DATE_FORMAT(v.fecha,'%Y-%m-%d %H:%i:%s') AS date,
      v.precio_total AS total,v.entregado AS delivered,v.envio AS shipping,
      v.direccion_entrega AS deliveryAddress,v.instrucciones_entrega AS deliveryInstructions
      FROM venta v JOIN clientes c ON c.id_clien=v.id_cliente
      JOIN persona p ON p.id_pers=c.id_pers ORDER BY v.entregado ASC,v.fecha DESC,v.id_venta DESC`);
    res.json(await loadSaleDetails(db.promise(),sales));
  } catch(e) { console.error(e);res.status(500).json({error:'No se pudieron consultar las ventas'}); }
});

app.patch('/api/ventas/:id/entrega',async(req,res)=>{
  const user=sessionForRole(req,res,'admin');
  if (!user) return;
  const id=Number(req.params.id);
  if (!Number.isSafeInteger(id)||id<=0||typeof req.body?.delivered!=='boolean') {
    return res.status(400).json({error:'Datos de entrega inválidos'});
  }
  try {
    const [r]=await db.promise().query('UPDATE venta SET entregado=? WHERE id_venta=?',
      [req.body.delivered?1:0,id]);
    if (!r.affectedRows) return res.status(404).json({error:'Venta inexistente'});
    res.json({ok:true,id,delivered:req.body.delivered});
  } catch(e) {console.error(e);res.status(500).json({error:'No se pudo actualizar la entrega'});}
});

const PORT = 3000;

// Catálogos consultados desde MySQL (sin datos de ejemplo).
app.get('/api/catalogos/especies', async (_req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT id_especie, tipo_especie FROM especie ORDER BY tipo_especie');
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al consultar especies' }); }
});
app.get('/api/catalogos/razas', async (req, res) => {
  try {
    const id = Number(req.query.id_especie);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id_especie inválido' });
    const [rows] = await db.promise().query('SELECT id_raza, id_especie, tipo_raza FROM raza WHERE id_especie = ? ORDER BY tipo_raza', [id]);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al consultar razas' }); }
});
app.get('/api/catalogos/servicios', async (_req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT id_servicio, descripcion, duracion_minutos FROM servicio ORDER BY descripcion');
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al consultar servicios' }); }
});
app.get('/api/catalogos/feriados', async (_req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT id_feriado, nombre, dia_mes FROM feriados ORDER BY dia_mes');
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al consultar feriados' }); }
});

// Configuración general del negocio (razón social, teléfono, dirección, etc.)
app.get('/api/configuracion', async (_req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM configuracion LIMIT 1');
    res.json(rows[0] || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al consultar la configuración' });
  }
});

// Días y horarios de atención (para el calendario de turnos)
app.get('/api/dias-atencion', async (_req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM dias_atencion');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al consultar los días de atención' });
  }
});

app.listen(PORT, () => {
    console.log(`Servidor Backend actualizado en http://localhost:${PORT}`);
});