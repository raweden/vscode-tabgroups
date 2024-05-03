
import { default as crypto } from 'node:crypto';
import { default as path } from 'node:path';
import { TabGroupDTO } from "./data-model";

export class Utils {

    static _getEditorState(uri) {
        let states = Utils._editorStates;
        let len = states.length;
        for (let i = 0; i < len; i++) {
            let state = states[i];
            if (state.uri == uri) {
                return state;
            }
        }

        return null;
    }

    static createTabObject(uri) {
        let state, filename = path.basename(uri);
        let newTab = {name: filename, uri: uri, scheme: null, isPinned: false};
        state = Utils._getEditorState(uri);
        if (state) {
            newTab.visibleRanges = state.visibleRanges;
        }

        return newTab;
    }

    static get_workspace_file(folder) {
        let result = null;
        fs.readdirSync(folder).forEach(fileName => {
            if (result == null && fileName.endsWith(".code-workspace"))
                result = path.join(folder, fileName);
        });
        return result;
    }
        
    static createNewList(list_name) {
        let dto = new TabGroupDTO();
        dto.name = list_name;
        dto.mtime = Date.now();
        dto._uuid = crypto.randomUUID();
        dto._storage = Utils._dataProvider.defaultStore;
        Utils._dataProvider.defaultStore.addGroup(dto);
        return dto;
    }
}