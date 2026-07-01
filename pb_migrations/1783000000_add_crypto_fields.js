/// <reference path="../pocketbase_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)

  // 1. Update users
  const usersCollection = dao.findCollectionByNameOrId("_pb_users_auth_")
  usersCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "pubkeyex",
    "name": "public_key_exchange",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  usersCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "pubkeysi",
    "name": "public_key_sign",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  dao.saveCollection(usersCollection)

  // 2. Update room_members
  const roomMembersCollection = dao.findCollectionByNameOrId("room_members")
  roomMembersCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "encrmkey",
    "name": "encrypted_room_key",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  dao.saveCollection(roomMembersCollection)

  // 3. Update drawings
  const drawingsCollection = dao.findCollectionByNameOrId("drawings")
  drawingsCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "signatur",
    "name": "signature",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  dao.saveCollection(drawingsCollection)

  // 4. Update messages
  const messagesCollection = dao.findCollectionByNameOrId("messages")
  messagesCollection.schema.addField(new SchemaField({
    "system": false,
    "id": "msgssign",
    "name": "signature",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))
  dao.saveCollection(messagesCollection)

}, (db) => {
  const dao = new Dao(db)

  // revert users
  const usersCollection = dao.findCollectionByNameOrId("_pb_users_auth_")
  usersCollection.schema.removeField("pubkeyex")
  usersCollection.schema.removeField("pubkeysi")
  dao.saveCollection(usersCollection)

  // revert room_members
  const roomMembersCollection = dao.findCollectionByNameOrId("room_members")
  roomMembersCollection.schema.removeField("encrmkey")
  dao.saveCollection(roomMembersCollection)

  // revert drawings
  const drawingsCollection = dao.findCollectionByNameOrId("drawings")
  drawingsCollection.schema.removeField("signatur")
  dao.saveCollection(drawingsCollection)

  // revert messages
  const messagesCollection = dao.findCollectionByNameOrId("messages")
  messagesCollection.schema.removeField("msgssign")
  dao.saveCollection(messagesCollection)
})
