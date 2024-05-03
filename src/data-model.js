
import { Utils } from "./utils";

/**
 * @typedef {TabGroupItem}
 * @type {Object}
 * @property {}
 */
export class TabGroupDataProvider {
    constructor (groups) {
        /** @type {TabGroupDTO} */
        this._groups = Array.isArray(groups) ? groups : [];
        /** @type {TabGroupLocalStorage} */
        this._defaultStore = null;
        this._defaultStorePath = null;
        /** @type {TabGroupLocalStorage} */
        this._stores = [];
    }

    get defaultStore() {
        if (this._defaultStore == null) {
            let store = new TabGroupLocalStorage([]);
            store.dataLocation = this._defaultStorePath;
            store._dataProvider = this;
            this._defaultStore = store;
            this._stores.push(store);
        }

        return this._defaultStore;
    }   

    /**
     * 
     * @param {TabGroupLocalStorage} store 
     * @param {boolean} isDefault 
     */
    addStore(store, isDefault) {
        let stores = this._stores;
        let idx = stores.indexOf(store);
        if (idx === -1) {
            store._dataProvider = this;
            stores.push(store);
            let oldGroups = this._groups;
            let newGroups = store._groups;
            let len = newGroups.length;
            for (let i = 0; i < len; i++) {
                let group = newGroups[i];
                if (typeof group._uuid != "string" || group._uuid.length == 0) {
                    continue;
                }
                if (oldGroups.indexOf(group) === -1 && this.getTabGroupById(group._uuid) == null) {
                    oldGroups.push(group);
                }
            }
        }

        if (isDefault === true)
            this._defaultStore = store;
    }

    removeStore(store) {
        let stores = this._stores;
        let idx = stores.indexOf(store);
        if (idx !== -1)
            stores.splice(idx, 1);

        if (this._defaultStore === store) {
            this._defaultStore = null;
        }
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    addGroup(group) {
        let groups = this._groups;
        if (groups.indexOf(group) !== -1)
            return;
        groups.push(group);
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    removeTabGroup(group) {
        let groups = this._groups;
        let index = groups.indexOf(group);
        if (index !== -1)
            groups.splice(index, 1);
        group._storage.removeTabGroup(group);
    }

    /**
     * 
     * @param {TabGroupItem} newTab 
     * @param {TabGroupItem} oldTab 
     */
    insertBefore(newTab, oldTab) {
        let groups = this._groups;
        let oldParent, oldIndex = -1;
        let newParent, newIndex = -1;
        let len = groups.length;
        for (let i = 0; i < len; i++) {
            let group = groups[i];
            if (newIndex === -1) {
                newIndex = group._items.indexOf(oldTab);
                newParent = group;
            }
            if (oldIndex === -1) {
                oldIndex = group._items.indexOf(newTab);
                oldParent = group;
            }
            
            if (newIndex !== -1 && oldIndex !== -1)
                break;
        }

        if (newIndex === -1)
            return;

        if (oldIndex !== -1) {
            oldParent._items.splice(oldIndex, 1);
            oldParent._isDirty = true;
            if (oldParent._storage)
                oldParent._storage._isDirty = true;
        }

        newParent._items.splice(newIndex, 0, newTab);
        newParent._isDirty = true;
        if (newParent._storage)
            newParent._storage._isDirty = true;
    }

    /**
     * 
     * @param {TabGroupItem} tab
     */
    removeTab(tab) {
        let groups = this._groups;
        let idx, len = groups.length;
        for (let i = 0; i < len; i++) {
            let group = groups[i];
            idx = group._items.indexOf(tab);
            if (idx !== -1) {
                group._items.splice(idx, 1);
                group.mtime = Date.now();
                group._isDirty = true;
                if (group._storage)
                    group._storage._isDirty = true;
                break;
            }
        }

        return;
    }

    /**
     * 
     * @param {string} uuid 
     * @returns {?TabGroupDTO}
     */
    getTabGroupById(uuid) {
        let group, groups = this._groups;
        let len = groups.length;
        for (let i = 0; i < len; i++) {
            group = groups[i];
            if (group._uuid == uuid) {
                return group;
            }
        }

        return null;
    }
}

export class TabGroupLocalStorage {

    constructor (groups) {
        /** @type {TabGroupDTO} */
        this._groups = Array.isArray(groups) ? groups : [];
        /** @type {string} */
        this.dataLocation = null;
        /** @type {TabGroupDataProvider} */
        this._dataProvider = null;
        this._isDirty = false;
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    addGroup(group) {
        let groups = this._groups;
        if (groups.indexOf(group) !== -1)
            return;
        groups.push(group);
        this._isDirty = true;
        if (this._dataProvider) {
            let g2, len, found = false;
            groups = this._dataProvider._groups;
            len = groups.length;
            for (let i = 0; i < len; i++) {
                g2 = groups[i];
                if (group._uuid == g2._uuid) {
                    found = true;
                    break;
                }
            }
            if (!found)
                groups.push(group);
        }
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    removeTabGroup(group) {
        let groups = this._groups;
        let index = groups.indexOf(group);
        if (index !== -1)
            groups.splice(index, 1);
        this._isDirty = true;
    }

    /**
     * 
     * @param {string} uuid 
     * @returns {?TabGroupDTO}
     */
    getTabGroupById(uuid) {
        let group, groups = this._groups;
        let len = groups.length;
        for (let i = 0; i < len; i++) {
            group = groups[i];
            if (group._uuid == uuid) {
                return group;
            }
        }

        return group;
    }

    toJSON() {
        return {groups: this._groups};
    }
};

export class TabViewColumn {
    constructor (id) {
        this.id = id;
    }
};

export class TabGroupDTO {

    constructor () {
        this._uuid;
        this.name = "";
        this._viewColumns = null;
        this._items = [];
        /** @type {TabGroupLocalStorage} */
        this._storage = null;
        this._isDirty = false;
        this.mtime = null;
    }

    addItem(item) {
        let items = this._items;
        if (items.indexOf(item) !== -1)
            return;
        items.push(item);
        this._isDirty = true;
        if (this._storage)
            this._storage._isDirty = true;
    }

    toJSON() {
        let viewColumns = this._viewColumns;
        let tabItems;
        if (!viewColumns) {
            tabItems = this._items;
        } else {
            let orgItems = this._items;
            tabItems = [];
            let len = orgItems.length;
            for (let i = 0; i < len; i++) {
                let org = orgItems[i];
                let cpy = Object.assign({}, org);
                cpy.viewColumn = viewColumns.indexOf(org.viewColumn);
                tabItems.push(cpy);
            }
        }
        return {uuid: this._uuid, name: this.name, items: tabItems, viewColumns: this._viewColumns, mtime: (this.mtime && this.mtime instanceof Date ? this.mtime.getTime() : this.mtime) };
    }
};

// saving data

export const TAB_GROUP_FILENAME = "tab-goups.localStorage.json";

let _delayedWriteId = -1;

function doDelayedWrite() {
    _delayedWriteId = -1;
    let dataProvider = Utils._dataProvider;
    /** @type {TabGroupLocalStorage[]} */
    let stores = dataProvider._stores;
    if (stores.length == 0)
        return;
    let jsonData;
    let len = stores.length;
    for (let i = 0; i < len; i++) {
        let store = stores[i];
        let hasdir, filepath = store.dataLocation;
        if (store._isDirty == false || typeof filepath != "string" || filepath.length == 0)
            continue;

        try {
            fs.accessSync(filepath, fs.constants.W_OK | fs.constants.R_OK);
            hasdir = true;
        } catch (err) {
            console.error(err);
            hasdir = false;
            if (err.code == "ENOENT") {

            }
        }

        if (!hasdir) {
            try {
                let dirpath = path.dirname(filepath);
                fs.mkdirSync(dirpath, {recursive: true});
            } catch (err) {
                console.error(err);
            }
        }

        try {
            jsonData = JSON.stringify(store, null, 4);
            fs.writeFileSync(filepath, jsonData, {encoding: 'utf-8'});
            store._isDirty = false;
        } catch (err) {
            console.error(err);
        }
    }
}

function addDelayedWrite() {
    if (_delayedWriteId !== -1)
        return;
    _delayedWriteId = setTimeout(doDelayedWrite, 500);
}

export function asyncSaveData() {
    addDelayedWrite();
}

export function tab_groups_explicit_save() {
    addDelayedWrite();
}