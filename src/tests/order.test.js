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
let testUser;
let testUserAuthToken;

beforeAll(async () => {
    testUser = { name: `testUser-${randomName()}`, email: `${randomName()}@test.com`, password: `${randomName()}`};
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminUserToken = loginRes.body.token;
});

test('add an item to the menu', addMenuItem);

async function addMenuItem() {
    const addItemReqBody = { title: `testItem-${randomName()}`, description: 'a test menu item - nothing special.', image: 'test-image.png', price: 0.0001};
    const addItemRes = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${testAdminUserToken}`)
        .send(addItemReqBody);
    expect(addItemRes.status).toBe(200);
    expect(addItemRes.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
            id: expect.any(Number),
            title: addItemReqBody.title,
            description: addItemReqBody.description,
            image: addItemReqBody.image,
            price: addItemReqBody.price
        })
    ]));
    return addItemRes;
}

test('get menu', async () => {
    const getMenuRes = await request(app)
        .get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);
});
