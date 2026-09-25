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

let testAdminUser;
let testAdminUserToken;

beforeAll(async () => {
    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminUserToken = loginRes.body.token;
});

test('create a franchise', async() => {
    const franchiseName = `testFranchise-${randomName()}`;
    const franchiseReqBody = { name: franchiseName, admins: [{ email: testAdminUser.email }] };
    const franchiseCreationRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${testAdminUserToken}`)
        .send(franchiseReqBody);
    expect(franchiseCreationRes.status).toBe(200);
    expect(franchiseCreationRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(franchiseCreationRes.body).toMatchObject({
            name: franchiseName,
            admins: [{ 
                email: testAdminUser.email, 
                id: testAdminUser.id,
                name: testAdminUser.name 
            }], 
            id: expect.any(Number)
    });
});