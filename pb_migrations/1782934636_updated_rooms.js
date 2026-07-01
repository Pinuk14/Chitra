/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("8hg4xu31j266haq")

  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\" && owner_id = @request.auth.id"
  collection.deleteRule = "@request.auth.id != \"\" && owner_id = @request.auth.id"

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "csspijwo",
    "name": "owner_id",
    "type": "text",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "jagljpik",
    "name": "access_mode",
    "type": "select",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSelect": 1,
      "values": [
        "public",
        "invite_only",
        "manual_approval"
      ]
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("8hg4xu31j266haq")

  collection.createRule = ""
  collection.updateRule = ""
  collection.deleteRule = ""

  // remove
  collection.schema.removeField("csspijwo")

  // remove
  collection.schema.removeField("jagljpik")

  return dao.saveCollection(collection)
})
