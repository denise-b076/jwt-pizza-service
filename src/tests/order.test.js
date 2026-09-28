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
let testFranchise;
let testStore;

beforeAll(async () => {
    testUser = { name: `testUser-${randomName()}`, email: `${randomName()}@test.com`, password: `${randomName()}`};
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUser.id = registerRes.body.user.id;

    testAdminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdminUser);
    testAdminUserToken = loginRes.body.token;

    const franchiseName = `testFranchise-${randomName()}`;
    const franchiseCreationReqBody = { name: franchiseName, admins: [{ email: testAdminUser.email }] };
    testFranchise = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${testAdminUserToken}`)
        .send(franchiseCreationReqBody);

    const franchiseID = testFranchise.body.id;
    const storeName = `testStore-${randomName()}`;
    const createStoreReqBody = { franchiseID: franchiseID, name: storeName, }; 
    testStore = await request(app)
        .post(`/api/franchise/${franchiseID}/store`)
        .set('Authorization', `Bearer ${testAdminUserToken}`)
        .send(createStoreReqBody);
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

test('create an order', createOrder);

async function createOrder() {
    const createOrderReqBody = { 
        franchiseId: testFranchise.body.id,  
        storeId: testStore.body.id, 
        items: [{
            menuId: 1,
            description: 'Veggie',
            price: 0.05
        }]
    };
    const createOrderRes = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(createOrderReqBody);
    expect(createOrderRes.status).toBe(200);
    expect(createOrderRes.body).toMatchObject({
        order: {
            franchiseId: testFranchise.body.id,
            storeId: testStore.body.id,
            items: createOrderReqBody.items,
        }
    });
    expect(createOrderRes.body.jwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    return createOrderRes;
}

test('get a users orders', async () => {
    const createOrderRes = await createOrder();
    const getUserOrders = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getUserOrders.status).toBe(200);
    expect(getUserOrders.body).toMatchObject({
        dinerId: testUser.id,
        orders: expect.arrayContaining([
            expect.objectContaining({
                id: createOrderRes.body.order.id,
                franchiseId: createOrderRes.body.order.franchiseId,
                storeId: createOrderRes.body.order.storeId,
                items: expect.arrayContaining([
                    expect.objectContaining(createOrderRes.body.order.items[0])
                ])
            })
        ])
    });
});
