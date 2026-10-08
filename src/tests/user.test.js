const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');
const { Role } = require('../model/model.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  user.password = 'toomanysecrets';

  return user;
}

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testAdminUser;
let testAdminUserToken;

beforeAll(async () => {
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUser.id = registerRes.body.user.id;
    testUser.roles = registerRes.body.user.roles;
    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminUserToken = loginRes.body.token;
});

test('get authenticated user', async () => {
    const getUserRes = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getUserRes.status).toBe(200);
    expect(getUserRes.body).toMatchObject({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
        roles: testUser.roles
    });
});

test('update user', async () => {
    const putUserReqBody = { name: randomName(), email: testUser.email, password: testUser.password};
    const putUserRes = await request(app)
        .put(`/api/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(putUserReqBody);
    expect(putUserRes.status).toBe(200);
    expect(putUserRes.body).toMatchObject({
        user: {
            id: testUser.id,
            name: putUserReqBody.name,
            email: testUser.email,
            roles: testUser.roles
        }
    });
    expect(putUserRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    expect(putUserRes.body.token).not.toBe(testUserAuthToken);
    testUserAuthToken = putUserRes.body.token;
});

test('delete user failed', async () => {
    const deleteUserRes = await request(app)
        .delete(`/api/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(deleteUserRes.status).toBe(403);
    expect(deleteUserRes.body).toMatchObject({
        message: 'unauthorized'
    });
});

test('delete user success', async () => {
    const deleteUserRes = await request(app)
        .delete(`/api/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testAdminUserToken}`);
    expect(deleteUserRes.status).toBe(200);
    expect(deleteUserRes.body).toMatchObject({
        message: 'deleted user'
    });
});