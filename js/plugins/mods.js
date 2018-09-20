// Game_Event
(function () {
    let setupPageSettings = Game_Event.prototype.setupPageSettings;
    Game_Event.prototype.setupPageSettings = function () {
        setupPageSettings.call(this);

        this.proceedComments();

    };

    //Static function
    Game_Event.isValidComment = function (comment) {
        let typeRegex = /"type"[ \t]{0,}:[ \t]{0,}"/;
        if (!typeRegex.test(comment)) {
            return false
        }

        let brackets = /^[ \t]{0,}{.*}[ \t]{0,}$/;
        if (!brackets.test(comment)) {
            return false
        }

        try {
            JSON.parse(comment)
        } catch (e) {
            return false
        }

        return true
    };

    //Static function
    Game_Event.isSeparComment = function (comment) {
        return /^\/\//.test(comment) || /^---/.test(comment)
    };

    //Static function
    Game_Event.collectComments = function (pageObject) {
        //Static function to iterate over page comments

        let comments = [];

        //Collect json string data from all comments on page
        //One liners begins with --- or // works like separators
        //If two comments with no separator - it's merging together
        //Be careful
        let list = pageObject.list;
        let currentComment = "";

        for (let i = 0; i < list.length; i++) {
            let value = list[i];
            let parameter = value.parameters[0];

            let hasData = currentComment.length > 0;

            if (value.code === 108) {
                //New comment code, check separator and spit or merge

                // Comments-separators can be one line or multiline
                if (Game_Event.isSeparComment(parameter)) {
                    //If there is some comment data before - split and prepare new empty one
                    if (hasData) {
                        comments.push(currentComment);
                        currentComment = "";
                    }
                } else {
                    //No separator, merge with previous or with empty one
                    currentComment += parameter;
                }
            } else if (value.code === 408) {
                // Ignore line begins with separator in json comment or multiline separator comment
                if (Game_Event.isSeparComment(parameter)) {

                    continue
                }

                //Continue comment code
                currentComment += parameter;
            } else if (hasData) {
                //If has comment data, and there is no comment codes - push to pool and prepare new empty one
                comments.push(currentComment);
                currentComment = "";

                //Current entry is not head nor body comment
                //Break loop, we don't need to iterate full list, just head
                break
            }

        }

        //Replace (') to valid json (")
        comments = comments.map(comment => comment.replace(/'/g, "\""));

        //Filter out invalid comments
        comments = comments.filter(comment => Game_Event.isValidComment(comment));

        //Convert json to objects
        comments = comments.map(comment => JSON.parse(comment));

        return comments
    };

    Game_Event.prototype.proceedComments = function () {
        let comments = Game_Event.collectComments(this.page());

        this.applyComments(comments)

    };

    let canPass = Game_Event.prototype.canPass;
    Game_Event.prototype.canPass = function (x, y, d) {
        let x2 = $gameMap.roundXWithDirection(x, d);
        let y2 = $gameMap.roundYWithDirection(y, d);

        if ($gameMap.regionId(x2, y2) === 3) {
            return false
        } else if ($gameMap.regionId(x2, y2) === 4) {
            return false
        } else {
            return canPass.apply(this, arguments)
        }
    };

    Game_Event.prototype.applyComments = function (objects) {
        // Setup character sprite additional layers
        let accessories = objects.find(conf => conf.type === "accessories");
        if (accessories) {
            this._accessories = accessories.layers;
        } else {
            //There is no accessories - clear array,
            this._accessories = []
        }
    };

})();

// Sprite_Character
(function () {
    let initialize = Sprite_Character.prototype.initialize;
    Sprite_Character.prototype.initialize = function (character) {
        this._accessories = [];
        this._accessoriesSprites = [];

        initialize.apply(this, arguments);

        // pattern:
        // If: x/y - start block at top left corner
        // If bool - set visible
        // If number - set timeout
        // If array - set random timeout

        this.accPresets = {
            eyesPlayer: [[220, 320], {x: 0, y: 0}, true, 10, {x: 3, y: 0}, 10, false],
            mouthPlayer: [[60, 120], {x: 3, y: 4}, true, 10, {x: 0, y: 4}, 10, {x: 3, y: 4}, 10, false],

            dogmeatSmallEyes: [[220, 320], {x: 0, y: 0}, true, 20, false],
            ianWink: [[220, 320], {x: 0, y: 0}, true, 10, false],
        };

        if (character instanceof Game_Player) {
            //Not need dynamic accessories for player now
            this._accessories = [
                {image: '!MainChar_blink-breathe', pattern: 'eyesPlayer'},
                {image: '!MainChar_blink-breathe', pattern: 'mouthPlayer'},
            ];
        }
    };

    Sprite_Character.prototype.isAccessoriesChanged = function () {
        //After load $gameMap objects recreate from json, so array strict check is false
        //It's ok, this.isImageChanged returns true after loading anyway
        //return isImageChanged.call(this) || this._character._accessories !== this._accessories;

        if (!this._character) {
            return false
        }

        if (this._character instanceof Game_Player) {
            // First update of player - accessories set by default
            // Need create sprites only once
            return this._accessoriesSprites.length <= 0;
        }

        //Accessories currently only work with Game_Event and Game_Player
        //Prevent setAccessories on enything else
        if (!(this._character instanceof Game_Event)) {
            return false
        }


        if (this._character._accessories !== this._accessories) {
            this._accessories = this._character._accessories;
            return true
        }

    };

    let updateBitmap = Sprite_Character.prototype.updateBitmap;
    Sprite_Character.prototype.updateBitmap = function () {
        if (this.isAccessoriesChanged()) {
            this.setAccessories();
        }

        updateBitmap.call(this);
    };

    Sprite_Character.prototype.setAccessories = function () {
        //Just simple recreate sprites
        if (this._accessoriesSprites.length > 0) {
            this._accessoriesSprites.forEach(sprite => this.removeChild(sprite));
            this._accessoriesSprites = []
        }

        if (this._accessories.length > 0) {
            this._accessories.forEach(config => {
                let sprite = new Sprite();
                sprite.bitmap = ImageManager.loadCharacter(config.image);
                sprite.anchor.x = 0.5;
                sprite.anchor.y = 1;

                // Invisible until update frame
                sprite.visible = false;
                this._accessoriesSprites.push(sprite);
                this.addChild(sprite)
            })
        }
    };

    Sprite_Character.prototype.getRandom = function () {
        //Arguments: (min, max) or (array)
        if (arguments.length === 2) {
            let min = arguments[0];
            let max = arguments[1];
            return Math.floor(Math.random() * (max - min + 1)) + min;
        } else if (arguments.length === 1) {
            let array = arguments[0];
            return array[Math.floor(Math.random() * array.length)];
        }
    };

    Sprite_Character.prototype.updateAccessoriesFrames = function () {
        let pw = this.patternWidth();
        let ph = this.patternHeight();
        let px = this.characterPatternX();
        let py = this.characterPatternY();

        for (let i = 0; i < this._accessoriesSprites.length; i++) {
            //Get id data from config array
            let settings = this._accessories[i];

            if (settings.pattern) {
                // Update animation

                // First animation iteration - sets start values
                if (settings.timeout === undefined) {
                    settings.timeout = 0;
                }

                if (settings.index === undefined) {
                    settings.index = 0;
                }

                let pattern = this.accPresets[settings.pattern];

                let current = pattern[settings.index];

                // Update frame every tick to last selected block, because player is change his direction and step pattern,
                if (settings.block) {
                    this._accessoriesSprites[i].setFrame((settings.block.x + px) * pw, (settings.block.y + py) * ph, pw, ph);
                }

                if (settings.timeout > 0) {
                    settings.timeout--;
                    continue
                }

                // Update timeouts, visibility and current block values
                if (Array.isArray(current)) {
                    // Random timeout
                     settings.timeout = this.getRandom(current[0], current[1]);
                } else if (typeof current === "boolean") {
                    // Visibility
                    this._accessoriesSprites[i].visible = current;
                } else if (typeof current === "number") {
                    // Fixed timeout
                    settings.timeout = current;
                } else if (typeof current === "object") {
                    // Change current block
                    settings.block = current;

                }

                // Increase animation position if last - go to zero
                settings.index++;
                if (pattern.length === settings.index) {
                    settings.index = 0;
                }


            } else {
                let frameId = this._accessories[i].id;

                let sx = ((frameId % 4 * 3) + px) * pn;
                let sy = ((Math.floor(frameId / 4) * 4) + py) * pn;

                //Apply frame to the sprites array
                this._accessoriesSprites[i].setFrame(sx, sy, pw, ph);
                if (!this._accessoriesSprites[i].visible) {
                    this._accessoriesSprites[i].visible = true;
                }

            }


        }
    };

    let updateCharacterFrame = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function () {
        updateCharacterFrame.call(this);
        this.updateAccessoriesFrames();
    };

})();

(function () {
    Scene_Map.prototype.createDisplayObjects = function() {
        this.createSpriteset();

        //Prevent _mapNameWindow errors
        this._mapNameWindow = {
            open: () => {},
            close: () => {},
            hide: () => {},
        }

        //Do not create windows

        // this.createMapNameWindow();
        // this.createWindowLayer();
        // this.createAllWindows();
    };

    //Disable unused resources
    Sprite_Actor.prototype.createShadowSprite = function() {};

    Sprite_Actor.prototype.updateShadow = function() {};

    Spriteset_Map.prototype.createShadow = function() {};

    Spriteset_Map.prototype.updateShadow = function() {};

    Scene_Boot.prototype.loadSystemWindowImage = function() {
        // ImageManager.reserveSystem('Window');
    };

    Scene_Boot.loadSystemImages = function() {
        // ImageManager.reserveSystem('IconSet');
        // ImageManager.reserveSystem('Balloon');
        // ImageManager.reserveSystem('Shadow1');
        // ImageManager.reserveSystem('Shadow2');
        // ImageManager.reserveSystem('Damage');
        // ImageManager.reserveSystem('States');
        // ImageManager.reserveSystem('Weapons1');
        // ImageManager.reserveSystem('Weapons2');
        // ImageManager.reserveSystem('Weapons3');
        // ImageManager.reserveSystem('ButtonSet');
    };

    //Import interpreter special calls
    Game_Interpreter.prototype.sprite = function (name) {
        return $mapScript.sprites[name];
    };

    Game_Interpreter.prototype.zoom = function (zoom, speed = 10) {
        this.setWaitMode("zoom");
        $gameMap.setZoom(zoom, zoom, speed);
    };

    Game_Interpreter.prototype.zoomDefault = function (speed = 10) {
        let zoom = ConfigManager.mapZoom ? 2 : 1;

        this.setWaitMode("zoom");
        $gameMap.setZoom(zoom, zoom, speed);
    };

    //Wait mode for zooming
    let updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === "zoom") {
            if ($gameMap._zoomDuration > 0) {
                return true;
            } else {
                this._waitMode = "";
            }
        } else {
            return updateWaitMode.call(this);
        }
    };

    //Terrain id passage options for player
    let canPass = Game_Player.prototype.canPass;
    Game_Player.prototype.canPass = function (x, y, d) {
        let x2 = $gameMap.roundXWithDirection(x, d);
        let y2 = $gameMap.roundYWithDirection(y, d);

        if (this._through) {
            return true
        }

        if (this.regionId() === 1 && $gameMap.regionId(x2, y2) === 1) {
            return true
        } else if (this.regionId() === 2 && $gameMap.regionId(x2, y2) === 1) {
            return true
        } else if ($gameMap.regionId(x2, y2) === 4) {
            return false
        }
        {
            return canPass.apply(this, arguments)
        }
    };

    //Hotkey map
    Input.keyMapper = {
        9: 'tab', // tab
        13: 'ok', // enter
        16: 'shift', // shift
        17: 'control', // control
        18: 'alt', // alt
        27: 'escape', // escape
        32: 'ok', // space
        33: 'pageup', // pageup
        34: 'pagedown', // pagedown
        65: 'left', // A
        37: 'left', // left arrow
        87: 'up', // W
        38: 'up', // up arrow
        68: 'right', // D
        39: 'right', // right arrow
        83: 'down', // S
        40: 'down', // down arrow
        45: 'escape', // insert
        81: 'pageup', // Q----
        82: 'pagedown', // W
        88: 'escape', // X
        90: 'ok', // Z
        96: 'escape', // numpad 0
        98: 'down', // numpad 2
        100: 'left', // numpad 4
        102: 'right', // numpad 6
        104: 'up', // numpad 8
        120: 'debug', // F9
        192: 'tilde',
        49: 'one',
        50: 'two',
        51: 'three',
        52: 'four',
        53: 'five',
        54: 'six',
        55: 'seven',
        56: 'eight',
        57: 'nine',
        48: 'zero',
        70: 'f'
    };

    //Some RAF loop changes
    SceneManager.fps = 60;
    SceneManager.then = performance.now();
    SceneManager.interval = 1000 / SceneManager.fps;
    SceneManager.tolerance = 1.5;
    SceneManager.frameDroppedCount = 0;

    SceneManager.updateMain = function () {

        this.requestUpdate();

        this.now = performance.now();
        this.delta = this.now - this.then;

        if (this.delta >= this.interval - this.tolerance) {
            this.then = this.now - (this.delta % this.interval);
            this.tickStart();

            this.updateInputData();
            this.changeScene();
            this.updateScene();
            this.renderScene();

            this.tickEnd();
        } else {
            SceneManager.frameDroppedCount++;
            // console.log('frame dropped! (count: ' + SceneManager.frameDroppedCount + ') ' + this.delta + " " + (this.interval - this.tolerance) + " " + new Date());
        }
    };

})();

//=============================================================================
// KODERA_optimization.js
//=============================================================================

//ForEach loops replacement

(function () {

    Sprite.prototype.update = function () {
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child && child.update) {
                child.update();
            }
        }
    };
    Tilemap.prototype.update = function () {
        this.animationCount++;
        this.animationFrame = Math.floor(this.animationCount / 30);
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child && child.update) {
                child.update();
            }
        }
        for (let i = 0; i < this.bitmaps.length; i++) {
            if (this.bitmaps[i]) {
                this.bitmaps[i].touch();
            }
        }
    };
    TilingSprite.prototype.update = function () {
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child && child.update) {
                child.update();
            }
        }
    };
    Window.prototype.update = function () {
        if (this.active) {
            this._animationCount++;
        }
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child && child.update) {
                child.update();
            }
        }
    };
    WindowLayer.prototype.update = function () {
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child && child.update) {
                child.update();
            }
        }
    };
    Weather.prototype._updateAllSprites = function () {
        let maxSprites = Math.floor(this.power * 10);

        while (this._sprites.length < maxSprites) {
            this._addSprite();
        }

        while (this._sprites.length > maxSprites) {
            this._removeSprite();
        }

        for (let i = 0; i < this._sprites.length; i++) {
            let sprite = this._sprites[i];
            this._updateSprite(sprite);
            sprite.x = sprite.ax - this.origin.x;
            sprite.y = sprite.ay - this.origin.y;
        }
    };
    Scene_Base.prototype.updateChildren = function () {
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child.update) {
                child.update();
            }
        }
    };

    Scene_ItemBase.prototype.applyItem = function () {
        let action = new Game_Action(this.user());
        action.setItemObject(this.item());
        let repeats = action.numRepeats();
        let ita = this.itemTargetActors();
        for (let i = 0; i < ita.length; i++) {
            let target = ita[i];
            for (let ix = 0; ix < repeats; ix++) {
                action.apply(target);
            }
        }
        action.applyGlobal();
    };
    Sprite_Animation.prototype.updateFrame = function () {
        if (this._duration > 0) {
            let frameIndex = this.currentFrameIndex();
            this.updateAllCellSprites(this._animation.frames[frameIndex]);
            for (let i = 0; i < this._animation.timings.length; i++) {
                let timing = this._animation.timings[i];
                if (timing.frame === frameIndex) {
                    this.processTimingData(timing);
                }
            }
        }
    };
    Spriteset_Map.prototype.createCharacters = function () {
        this._characterSprites = [];
        let events = $gameMap.events();
        for (let i = 0; i < events.length; i++) {
            let event = events[i];
            this._characterSprites.push(new Sprite_Character(event));
        }
        // let vehicles = $gameMap.vehicles();
        // for (let i = 0; i < vehicles.length; i++) {
        //     let vehicle = vehicles[i];
        //     this._characterSprites.push(new Sprite_Character(vehicle));
        // }
        let followers = $gamePlayer.followers()._data;
        for (let i = followers.length - 1; i >= 0; i--) {
            let follower = followers[i];
            this._characterSprites.push(new Sprite_Character(follower));
        }
        this._characterSprites.push(new Sprite_Character($gamePlayer));
        for (let i = 0; i < this._characterSprites.length; i++) {
            this._tilemap.addChild(this._characterSprites[i]);
        }
    };

})();

//=============================================================================
// MUE_AntiLag.js
//=============================================================================

//Some replacements for better speed

(function () {

// Replaces the original refreshTileEvents to filter the _events array directly
    Game_Map.prototype.refreshTileEvents = function () {
        this.tileEvents = this._events.filter(function (event) {
            return !!event && event.isTile();
        });
    };

// Replaces the original eventsXy to filter the _events array directly
    Game_Map.prototype.eventsXy = function (x, y) {
        return this._events.filter(function (event) {
            return !!event && event.pos(x, y);
        });
    };

// Replaces the original eventsXyNt to filter the _events array directly
    Game_Map.prototype.eventsXyNt = function (x, y) {
        return this._events.filter(function (event) {
            return !!event && event.posNt(x, y);
        });
    };

})();