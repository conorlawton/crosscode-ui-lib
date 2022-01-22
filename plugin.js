export default class UILib {
	prestart() {

		// Redness for testing

		// sc.ButtonGui.inject({
		// 	init(...args) {
		// 		this.parent(...args);
		// 		this.hook.screenCoords = {}
		// 	},
		// 	updateDrawables(renderer) {
		// 		this.parent(renderer);
		// 		renderer.addColor("red", 0, 0, this.hook.size.x, this.hook.size.y);
		// 	}
		// })

		// sc.RegularBoxGui.inject({
		// 	init(...args) {
		// 		this.parent(...args);
		// 		this.hook.screenCoords = {}
		// 	},
		// 	updateDrawables(renderer) {
		// 		this.parent(renderer);
		// 		renderer.addColor("red", 0, 0, this.hook.size.x, this.hook.size.y);
		// 	}
		// })

		// Create the XMLLoadable and UIXML classes

		ig.module("nax-uilib")
			.requires("impact.base.loader")
			.defines(function () {

				let	VECTOR_REGEX = /((?:[0-9]*[.])?[0-9]+%?)\s((?:[0-9]*[.])?[0-9]+%?)/;
				let ALIGN_REGEX = /(top|bottom|cent(?:re|er))\s(left|right|cent(?:re|er))/i;
				let CLASS_REGEX = /([a-z][-a-z0-9]*)/gi;
				let ID_REGEX = /([a-z][-a-z0-9]*)/i;

				sc.XMLLoadable = ig.Loadable.extend({
					init: function (a) {
						this.parent(a);
						if (typeof a == "object") this.onload(a)
					},

					loadInternal: function () {
						$.ajax({
							dataType: "xml",
							url: ig.getFilePath(this.getXMLPath()),
							context: this,
							success: this.onXMLLoaded.bind(this),
							error: this.onXMLError.bind(this)
						})
					},

					onXMLLoaded: function (contents) {
						if (window.DOMParser) {
							let error = contents.querySelector("parsererror");
							if (error) {
								throw Error("XML file of path '" + this.path + "' failed to parse or load." + error.textContent);
							}
							ig.activateCollectors(this);
							this.onload(contents);
							ig.removeCollectors(this);
							this.loadingFinished(true)
						}
					},

					onXMLError: function () {
						this.onerror && this.onerror();
						this.loadingFinished(false)
					}
				});

				sc.UIXML = sc.XMLLoadable.extend({
					cacheType: "UIXML",
					data: null,
					callback: null,
					ids: {},
					classes: {},
					button_groups: {},
					UIFactoryFunctions: {
						"state": function (attributes) {
							return attributes;
						},

						"transition": function (attributes, state) {
							let transition = {}
							transition[attributes.name] = state;
							return transition;
						},

						// TODO: TEST BOX NOT AN ACTUAL BOX NEED TO CHANGE TO MAKE IT NORMAL BOX
						"box": function (attributes, parent, hook) {
							let test = new sc.ButtonBgGui(50, {
								height: 50,
								ninepatch: sc.BUTTON_TYPE.DEFAULT.ninepatch
							});
							test.setPos(hook.pos.x, hook.pos.y);
							return {
								element: test,
								processChildren: true
							};
						},

						"regular-box": function (attributes, parent, hook) {
							let regularBox = new sc.RegularBoxGui("flipped" in attributes ? attributes.flipped : false);
							regularBox.hook = hook;

							if (attributes.padding) {
								let padding = "padding" in parseVector(attributes.padding);
								regularBox.PADDING_X = padding.x;
								regularBox.PADDING_Y = padding.y;
							}

							return {
								element: regularBox,
								processChildren: true
							};
						},

						"text": function (attributes, parent, hook) {
							let text = attributes.label ? ig.lang.get(attributes.label) : "";

							let textBlockProperties = {}
							textBlockProperties.font = attributes.font ? attributes.font : undefined,
								textBlockProperties.speed = attributes.speed ? ig.TextBlock.SPEED[attributes.speed.toUpperCase()] : ig.TextBlock.SPEED.IMMEDIATE,
								textBlockProperties.align = attributes.align ? ig.Font.ALIGN[attributes.align.toUpperCase()] : ig.Font.ALIGN.LEFT,
								textBlockProperties.maxWidth = attributes.maxWidth ? Number(attributes.maxWidth) : 0,
								textBlockProperties.bestRatio = attributes.bestRatio ? Number(attributes.bestRatio) : 0,
								textBlockProperties.linePadding = attributes.linePadding ? Number(attributes.linePadding) : 1

							return {
								element: new sc.TextGui(text, textBlockProperties),
								processChildren: false
							};
						},

						"button": function (attributes, parent, hook, children) {
							let text_xml = children.find(child => child.tagName === "text");

							let button_type_xml = children.find(child => child.tagName === "custom-button-type");

							let button_type = undefined;
							if (button_type_xml) {

								let ninepatch_xml = button_type_xml.children[0];
								let highlight_xml = button_type_xml.children[1];
								let offsets_xml = ninepatch_xml.children[0];

								let offsets = {};
								[...offsets_xml.children].forEach(offset_child => {
									let attributes = this.mapAttributes(offset_child);
									offsets[attributes.name] = this.parseVector(attributes.offset);
								});

								let pattern_attributes = this.mapAttributes(highlight_xml.children[0]);
								let highlight_attributes = this.mapAttributes(highlight_xml);

								let pattern = highlight_attributes["pattern"] ? new ig.ImagePattern(
									pattern_attributes["gfx"] ? pattern_attributes["gfx"] : "media/gui/buttons.png",
									pattern_attributes["source-x"] ? Number(pattern_attributes["source-x"]) : 73,
									pattern_attributes["source-y"] ? Number(pattern_attributes["source-y"]) : 0,
									pattern_attributes["width"] ? Number(pattern_attributes["width"]) : 15,
									pattern_attributes["height"] ? Number(pattern_attributes["height"]) : 24,
									pattern_attributes["repeat"] ? ig.ImagePattern.OPT[pattern_attributes["repeat"].toUpperCase().replace(/-/gi, "_")] : ig.ImagePattern.OPT.REPEAT_X,
								) : sc.BUTTON_TYPE.DEFAULT.highlight.pattern;

								let highlight = {
									startX: highlight_attributes["start-x"] ? Number(highlight_attributes["start-x"]) : 0,
									endX: highlight_attributes["end-x"] ? Number(highlight_attributes["end-x"]) : 0,
									leftWidth: highlight_attributes["left-width"] ? Number(highlight_attributes["left-width"]) : 0,
									rightWidth: highlight_attributes["right-width"] ? Number(highlight_attributes["right-width"]) : 0,
									offsetY: highlight_attributes["offset-y"] ? Number(highlight_attributes["offset-y"]) : 0,
									gfx: new ig.Image(highlight_attributes["gfx"] ? highlight_attributes["gfx"] : "media/gui/buttons.png"),
									pattern
								};

								let ninepatch = new ig.NinePatch(ninepatch_xml["gfx"] ? ninepatch_xml["gfx"] : "media/gui/buttons.png", {
									width: ninepatch_xml["width"] ? Number(ninepatch_xml["width"]) : 16,
									height: ninepatch_xml["height"] ? Number(ninepatch_xml["height"]) : 0,
									left: ninepatch_xml["left"] ? Number(ninepatch_xml["left"]) : 8,
									top: ninepatch_xml["top"] ? Number(ninepatch_xml["top"]) : 24,
									right: ninepatch_xml["right"] ? Number(ninepatch_xml["right"]) : 8,
									bottom: ninepatch_xml["bottom"] ? Number(ninepatch_xml["bottom"]) : 0,
									offsets
								});

								button_type = {
									height: button_type_xml["height"] ? Number(button_type_xml["height"]) : 24,
									ninepatch,
									highlight
								}
							}

							let button;
							if (text_xml) {
								let text = this.buildUI(text_xml, undefined);
								button = new sc.ButtonGui(
									text.text,
									attributes["button-width"] ? Number(attributes["button-width"]) : 100,
									button_type,
									attributes["submit-sound"] ? Number(attributes["submit-sound"]) : undefined,
									attributes["keep-pressed"] ? Number(attributes["keep-pressed"]) : false,
									attributes["blocked-sound"] ? Number(attributes["blocked-sound"]) : undefined,
									attributes["active"] ? Number(attributes["active"]) : false,
								);

								button.textChild = text;
							} else {
								button = new sc.ButtonGui(
									attributes["label"] ? ig.lang.get(attributes["label"]) : "Undefined",
									attributes["button-width"] ? Number(attributes["button-width"]) : 100,
									button_type,
									attributes["submit-sound"] ? Number(attributes["submit-sound"]) : undefined,
									attributes["keep-pressed"] ? Number(attributes["keep-pressed"]) : false,
									attributes["blocked-sound"] ? Number(attributes["blocked-sound"]) : undefined,
									attributes["active"] ? Number(attributes["active"]) : false,
								);
							}

							if (attributes["button-group"]) {
								this.button_groups[attributes["button-group"]].addFocusGui(button);
							}

							return {
								element: button,
								processChildren: false
							};
						},

						"button-group": function(attributes) {
							let button_group = new sc.ButtonGroup(
								attributes["no-sound"] ? attributes["no-sound"] === "true" : false,
								attributes["select-type"] ? ig.BUTTON_GROUP_SELECT_TYPE[attributes["select-type"].toUpperCase()] : undefined,
								attributes["loop-buttons"] ? attributes["loop-buttons"] === "true" : false
							);

							this.button_groups[attributes.name] = button_group;
							//sc.menu.buttonInteract.pushButtonGroup(button_group);

							return {
								element: null,
								processChildren: false
							}
						}
					},

					init: function (path, callback) {

						this.parent(path);
						if (callback) this.setCallback(callback);
					},

					setCallback: function (callback) {
						this.callback = callback.bind(this);
					},

					onload: function (data) {
						this.data = data;
						this.callback && this.callback(this.buildUI(this.data.children[0]));
					},

					getXMLPath: function () {
						return ig.root + this.path.toPath("mods/", ".xml") + ig.getCacheSuffix();
					},
					
					hookFactory(xml) {
						let hook = new ig.GuiHook({});
						let attributes = this.mapAttributes(xml);
						if ("z-index" in attributes) hook.zIndex = attributes["z-index"];
						if ("local-alpha" in attributes) hook.localAlpha = attributes["local-alpha"];
						if ("pos" in attributes) hook.pos = this.parseVector(attributes.pos);
						if ("pivot" in attributes) hook.pivot = this.parseVector(attributes.pivot);
						if ("size" in attributes) hook.size = this.parseVector(attributes.size);
						if ("scroll" in attributes) hook.scroll = this.parseVector(attributes.scroll);
						if ("align" in attributes) hook.align = this.mapAlignment(attributes.align);

						if (xml.children.length === 0) return hook;

						let transition_child = xml.children[0].tagName === "transitions" ? xml.children[0] : xml.children.length > 1 && xml.children[1].tagName === "transitions" ? xml.children[1] : null;
						let current_state_child = xml.children[0].tagName === "state" ? xml.children[0] : xml.children.length > 1 && xml.children[1].tagName === "state" ? xml.children[1] : null;

						if (transition_child) {
							let transitions = {};
							[...transition_child.children].forEach(transition => {
								let transition_attributes = this.mapAttributes(transition);
								let state = this.UIFactory(null, transition.firstElementChild);
								transition = {}
								transition.state = state;
								transition.time = transition_attributes.time ? transition_attributes.time : 0.5;
								transition.timeFunction = transition_attributes["key-spline"] ? this.mapKeySpline(transition_attributes["key-spline"]) : transition.timeFunction = KEY_SPLINES.EASE;
								transitions[transition_attributes.name] = transition;
							});

							hook.transitions = transitions;
						}

						if (current_state_child) {
							this.mergeWhereNotNaN(hook.currentState, this.mapAttributes(current_state_child));
						}

						return hook;
					},
					
					mapAlignment(alignment) {
						let y, x;
						alignment = ALIGN_REGEX.exec(alignment).slice(1, 3);
						if (alignment[0] === "top") y = ig.GUI_ALIGN.Y_TOP;
						if (alignment[0] === "bottom") y = ig.GUI_ALIGN.Y_BOTTOM;
						if (alignment[0] === "center" || alignment[0] === "centre") x = ig.GUI_ALIGN.X_CENTER;

						if (alignment[1] === "left") x = ig.GUI_ALIGN.X_LEFT;
						if (alignment[1] === "right") x = ig.GUI_ALIGN.X_RIGHT;
						if (alignment[1] === "center" || alignment[1] === "centre") x = ig.GUI_ALIGN.X_CENTER;

						return {
							x,
							y
						};
					},
					
					parseVector(string) {
						let out = {};
						let matches = VECTOR_REGEX.exec(string);
						if (matches == null) return null;
						out.scale_x = (matches[1].slice(-1) === "%");
						out.scale_y = (matches[2].slice(-1) === "%");
						out.x = Number(out.scale_x ? matches[1].slice(0, -1) : matches[1]);
						out.y = Number(out.scale_y ? matches[2].slice(0, -1) : matches[2]);
						return out;
					},
					
					UIFactory(parent, element, hook, children) {
						let attributes = this.mapAttributes(element)
						let out = this.UIFactoryFunctions[element.tagName].call(this, attributes, parent, hook, children);

						if (attributes.id) {
							let id = ID_REGEX.exec(attributes.id)[1];
							if (id) this.ids[id] = out.element;
						}

						if (attributes.class) {
							let classes = attributes.class.match(CLASS_REGEX);
							classes.forEach(clazz => {
								if (this.classes[clazz] === undefined) this.classes[clazz] = [];
								this.classes[clazz].push(out.element);
							});
						}

						return out;
					},

					kebabToCamel(text) {
						let words = text.split("-")
						return words[0] + words.slice(1).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
					},

					mapKeySpline(timeFunctionName) {
						return KEY_SPLINES[timeFunctionName.toUpperCase().replace(/-/g, "_")];
					},

					mapAttributes(element) {
						/** @type {[index: string]: string} */
						let attributes = {};
						for (let i = 0; i < element.attributes.length; i++) attributes[element.attributes[i].name] = element.attributes[i].value;
						return attributes;
					},

					mergeWhereNotNaN(target, source) {
						Object.keys(source).forEach(key => {
							let value = Number(source[key]);
							if (value !== NaN) target[key] = value;
						})
					},

					buildUI(xml, parent) {
						if (xml.tagName === "button-group") {
							this.UIFactory(parent, xml);
							return null;
						}

						let hook = undefined;
						let hasHook = false;

						// if (xml.children.length !== 0 && xml.children[0].tagName === "hook") {
						// 	hook = hookFactory(xml.children[0]);
						// 	hasHook = true;
						// }

						let children = [...xml.children];
						if (children.some(child => child.tagName === "hook")) {
							hook = this.hookFactory([...xml.children].find(child => child.tagName === "hook"));
							hasHook = true;
						}


						let out = this.UIFactory(parent, xml, hook, children);
						let element = out.element;
						if (!hasHook) hook = element.hook;
						else element.hook = hook;
						hook.gui = element;

						if (out.processChildren) {
							(hasHook ? children.slice(1) : children).forEach(child => {
								let child_element = this.buildUI(child, element);
								if (child_element) element.addChildGui(child_element);
							});
						}

						return element;
					}
				});
			});

		ig.module("test-menu")
			.requires("nax-uilib")
			.defines(function () {

				sc.ModMenu = sc.BaseMenu.extend({
					buttonGroup: null,
					init() {
						this.parent();
						this.hook.size.x = ig.system.width;
						this.hook.size.y = ig.system.height;
						this.buttonGroup = new sc.ButtonGroup;
						this.doStateTransition("DEFAULT", true);


						let ui = new sc.UIXML("ui-lib/assets/data/ui/test_ui");
						ui.setCallback((data) => {
							this.addChildGui(data);
							sc.menu.buttonInteract.addParallelGroup(ui.button_groups["test1"]);
						});
					},

					showMenu() {
						this.addObservers();
						sc.menu.buttonInteract.pushButtonGroup(this.buttonGroup);
						sc.menu.pushBackCallback(this.onBackButtonPress.bind(this));
						sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.HIDDEN);
					},

					hideMenu() {
						this.removeObservers();
						sc.menu.moveLeaSprite(0, 0, sc.MENU_LEA_STATE.LARGE);
						sc.menu.buttonInteract.removeButtonGroup(this.buttonGroup);
						this.exitMenu();
					},

					exitMenu() {},

					addObservers() {
						sc.Model.addObserver(sc.menu, this);
					},

					removeObservers() {
						sc.Model.removeObserver(sc.menu, this);
					},

					onBackButtonPress() {
						sc.menu.popBackCallback();
						sc.menu.popMenu();
					},

					modelChanged() {

					}
				});

				sc.MENU_SUBMENU.MODS = Math.max(...Object.values(sc.MENU_SUBMENU)) + 1;

				sc.SUB_MENU_INFO[sc.MENU_SUBMENU.MODS] = {
					Clazz: sc.ModMenu,
					name: "mods"
				};
				
				sc.TitleScreenButtonGui.inject({
					modsButton: null,

					postInit: function () {
						this.parent();

						this.modsButton = new sc.ButtonGui("\\i[help2]" + ig.lang.get("sc.gui.title-screen.mods"), null, true, sc.BUTTON_TYPE.EQUIP);
						this.modsButton.hook.transitions = {
							DEFAULT: {
								state: {},
								time: 0.2,
								timeFunction: window.KEY_SPLINES.EASE
							},
							HIDDEN: {
								state: {
									offsetY: -(this.changelogButton.hook.size.y + 4)
								},
								time: 0.2,
								timeFunction: window.KEY_SPLINES.LINEAR
							}
						};
						this.modsButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_TOP);
						this.modsButton.setHeight(26);
						this.modsButton.textChild.setPos(0, -1);
						this.modsButton.setPos((ig.extensions.getExtensionList().length > 0 ? this.dlcButton.hook.size.x + 6 : 0) + this.changelogButton.hook.size.x + 6, 2);
						this.modsButton.doStateTransition("HIDDEN", true);
						this.modsButton.onButtonPress = function () {
							this._enterModsMenu();
						}.bind(this);
						this.buttonInteract.addGlobalButton(this.modsButton, function () {
							return sc.control.menuHotkeyHelp2();
						}.bind(this));
						this.addChildGui(this.modsButton);
					},

					_enterModsMenu() {
						sc.menu.setDirectMode(true, sc.MENU_SUBMENU.MODS);
						sc.model.enterMenu(true);
					},

					show() {
						this.parent();
						this.modsButton && this.modsButton.doStateTransition("DEFAULT");
					},

					hide() {
						this.parent();
						this.modsButton && this.modsButton.doStateTransition("HIDDEN");
					}
				});
			});
	}
}