/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "m3ak18n2d7yb5fb",
    "created": "2026-07-01 19:37:16.797Z",
    "updated": "2026-07-01 19:37:16.797Z",
    "name": "moderation_log",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "pe0jmr1w",
        "name": "room_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "8kgqji0w",
        "name": "actor_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "vdlddpqv",
        "name": "target_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "6wo255bs",
        "name": "action",
        "type": "select",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": [
            "kick",
            "ban",
            "mute",
            "unban",
            "unmute",
            "promote",
            "demote"
          ]
        }
      },
      {
        "system": false,
        "id": "vbvvzqw2",
        "name": "reason",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "cc8siooq",
        "name": "expires_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      }
    ],
    "indexes": [],
    "listRule": "",
    "viewRule": "",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "",
    "deleteRule": "",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("m3ak18n2d7yb5fb");

  return dao.deleteCollection(collection);
})
