/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("dd86b1ojpp4x9q4")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "zjchzleu",
    "name": "name",
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

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("dd86b1ojpp4x9q4")

  // remove
  collection.schema.removeField("zjchzleu")

  return dao.saveCollection(collection)
})
