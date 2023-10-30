AFRAME.registerComponent("player", {
  schema: {
    mass: { type: "number", default: 70 }, // kg
    bounce: { type: "number", default: 0.1 }, // 0 - 1 (larger is more bouncy)
    gravity: { type: "number", default: -9.8 }, // m / s^2
    padding: { type: "number", default: 0.4 }, // m
    paddingHand: { type: "number", default: 0.03 }, // m
    handStrength: { type: "number", default: 50 },
    friction: { type: "number", default: 0.08 },
    keepAwayWallsDistance: { type: "number", default: 10 } // m
  },

  init: function() {
    let self = this;

    // raycaster (for collision detection with environment)
    this.el.setAttribute("raycaster", {
      objects: "#tile-specific",
      enabled: false,
      autoRefresh: false
    });

    // camera
    this.camera = document.createElement("a-entity");
    this.camera.setAttribute("camera", "");
    this.camera.setAttribute("look-controls", "");
    this.camera.setAttribute("wasd-controls", "");
    this.camera.setAttribute("position", { y: 1.6 });
    this.camera.setAttribute("raycaster", {
      objects: "#tile-specific",
      enabled: false,
      autoRefresh: false
    });
    this.el.appendChild(this.camera);

    // right hand
    this.rightHand = document.createElement("a-entity");
    this.rightHand.setAttribute("hand", "right");
    this.rightHand.setAttribute("raycaster", {
      objects: "#tile-specific",
      enabled: false,
      autoRefresh: false
    });
    this.el.appendChild(this.rightHand);

    // left hand
    this.leftHand = document.createElement("a-entity");
    this.leftHand.setAttribute("hand", "left");
    this.leftHand.setAttribute("raycaster", {
      objects: "#tile-specific",
      enabled: false,
      autoRefresh: false
    });
    this.score = document.createElement("a-text");
    this.score.setAttribute("value", "0")
    this.score.setAttribute("color", "#0397ac");
    this.score.setAttribute("align", "center");
    this.score.setAttribute("width", "0.9;");
    this.score.setAttribute("position", "-0.05 0.01 0.11");
    this.score.setAttribute("rotation", "-165 80 -90");
    this.leftHand.appendChild(this.score);
    this.el.appendChild(this.leftHand);

    // sounds
    this.rightHand.setAttribute("sound__shoot_web", "src: #sound-shoot-web; volume: 1; positional: false;");
    this.leftHand.setAttribute("sound__shoot_web", "src: #sound-shoot-web; volume: 1; positional: false;");
    this.rightHand.setAttribute("sound__no_web", "src: #sound-no-web; volume: 0.5; positional: false;");
    this.leftHand.setAttribute("sound__no_web", "src: #sound-no-web; volume: 0.5; positional: false;");
    this.el.setAttribute("sound__hit_wall", "src: #sound-hit-wall; positional: false;");
    this.el.setAttribute("sound__hit_ground", "src: #sound-hit-ground; positional: false;");

    // properties
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.cameraWorldPosition = new THREE.Vector3();
    this.rightHandWorldPosition = new THREE.Vector3();
    this.leftHandWorldPosition = new THREE.Vector3();
    this.lastCollisionWorldPosition = new THREE.Vector3();
    this.lastCollisionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
    this.scoreValue = 0;
    this.ticks = 0;

    // events
    window.addEventListener("keydown", function(evt) {
      if (evt.keyCode === 32 && !evt.repeat) {
        self.playWebSound(self.rightWeb.components.web.toggleWeb(self.camera, 1), "right");
      }
    });
    window.addEventListener("keyup", function(evt) {
      if (evt.keyCode === 32) {
        self.rightWeb.components.web.toggleWeb(self.camera, 0);
      }
    });
    this.rightHand.addEventListener("triggerchanged", function(evt) {
      self.playWebSound(self.rightWeb.components.web.toggleWeb(self.rightHand, evt.detail.value), "right");
    });
    this.rightHand.addEventListener("triggertouchend", function(evt) {
      self.rightWeb.components.web.toggleWeb(self.rightHand, 0);
    });
    this.leftHand.addEventListener("triggerchanged", function(evt) {
      self.playWebSound(self.leftWeb.components.web.toggleWeb(self.leftHand, evt.detail.value), "left");
    });
    this.leftHand.addEventListener("triggertouchend", function(evt) {
      self.leftWeb.components.web.toggleWeb(self.leftHand, 0);
    });
    this.rightHand.addEventListener("gripchanged", function(evt) {
      self.rightWeb.components.web.changeReduceWallDirForce(evt.detail.value);
    });
    this.rightHand.addEventListener("griptouchend", function(evt) {
      self.rightWeb.components.web.changeReduceWallDirForce(0);
    });
    this.leftHand.addEventListener("gripchanged", function(evt) {
      self.leftWeb.components.web.changeReduceWallDirForce(evt.detail.value);
    });
    this.leftHand.addEventListener("griptouchend", function(evt) {
      self.leftWeb.components.web.changeReduceWallDirForce(0);
    });
    this.rightHand.addEventListener("thumbstickmoved", function(evt) {
      self.rightWeb.components.web.changeLengthFactor(evt.detail.y);
    });
    this.rightHand.addEventListener("thumbstickup", function(evt) {
      self.rightWeb.components.web.changeLengthFactor(0);
    });
    this.leftHand.addEventListener("thumbstickmoved", function(evt) {
      self.leftWeb.components.web.changeLengthFactor(evt.detail.y);
    });
    this.leftHand.addEventListener("thumbstickup", function(evt) {
      self.leftWeb.components.web.changeLengthFactor(0);
    });

    this.players = [];
    for(let x = 0; x < 30; x++) {
      let player = document.createElement("a-sphere");
      player.setAttribute("radius", "1");
      player.setAttribute("color", "#3498db");
      player.timeStamp = Date.now();
      this.players.push(player);
    }
    this.arrows = [];
    for(let x = 0; x < 30; x++) {
      let arrow = document.createElement("a-sphere");
      arrow.setAttribute("radius", ".2");
      arrow.setAttribute("color", "#24885b");
      /*
      let arrow = document.createElement("a-cone");
      arrow.setAttribute("radius-top", ".1");
      arrow.setAttribute("radius-bottom", "0");
      arrow.setAttribute("height", "0.4");
      arrow.setAttribute("color", "#3498db");
      */
      this.arrows.push(arrow);
    }

    this.madeRequest = false;
    this.socket = null;
  },

  play: function() {
    this.rightWeb = document.getElementById("web-right");
    this.leftWeb = document.getElementById("web-left");
    this.map = document.getElementById("map");
    
    if (!this.camera.getAttribute("camera").active) {
      this.camera.setAttribute("camera", { active: true });
    }    
  },

  playWebSound: function(type, hand) {
    if (type == "shoot-web") {
      if (hand == "right") this.rightHand.components.sound__shoot_web.playSound();
      else this.leftHand.components.sound__shoot_web.playSound();
    } else if (type == "no-web") {
      if (hand == "right") this.rightHand.components.sound__no_web.playSound();
      else this.leftHand.components.sound__no_web.playSound();
    }
  },

  playCollideSound: function(type, strength) {
    if (type == "hit-wall") this.el.components.sound__hit_wall.playSound();
    else if (type == "hit-ground") this.el.components.sound__hit_ground.playSound();
  },

  updateScore: function() {
    this.score.setAttribute("value", `${this.scoreValue}`);
  },

  tick: function(time, timeDelta) {    
    let timeDeltaSec = Math.min(timeDelta / 1000, 1);
    let rigLocalPosition = this.el.object3D.position;
    let velocityRaycaster = this.el.components.raycaster;

    // apply gravity
    this.velocity.y += this.data.gravity * timeDeltaSec;

    // apply velocity and collide with environment
    velocityRaycaster.data.origin = this.camera.object3D.position;
    velocityRaycaster.data.direction = this.velocity;
    velocityRaycaster.raycaster.near = 0.01;
    velocityRaycaster.raycaster.far = Math.max(this.velocity.length() * timeDeltaSec, this.data.padding);
    velocityRaycaster.checkIntersections();
    if (!velocityRaycaster.intersections.length) {
      rigLocalPosition.addScaledVector(this.velocity, timeDeltaSec);
    } else {
      // collision with environment
      if(velocityRaycaster.intersections[0].object.el['part'][0] === 'wall') {
        this.velocity.reflect(velocityRaycaster.intersections[0].face.normal);
        this.velocity.multiplyScalar(this.data.bounce);
        // for keep away from walls
        this.lastCollisionWorldPosition = velocityRaycaster.intersections[0].point;
        this.lastCollisionPlane.setFromNormalAndCoplanarPoint(
          velocityRaycaster.intersections[0].face.normal,
          velocityRaycaster.intersections[0].point
        );
        this.playCollideSound("hit-wall", this.velocity.length());
      } else {
        if (this.velocity.y < -2) {
          this.playCollideSound("hit-wall", this.velocity.length());
        }
        this.velocity.reflect(new THREE.Vector3(0, 1, 0));
        this.velocity.multiplyScalar(this.data.bounce);
      }

      // sound hit wall
      if (advanced.checked){
        this.scoreValue = 0;
        this.updateScore();
      }
    }

    // collide with floor
    if (rigLocalPosition.y < 0) {
      // sound
      if (this.velocity.y < -2) {
        this.playCollideSound("hit-ground", Math.abs(this.velocity.y));
        if (advanced.checked){
          this.scoreValue = 0;
          this.updateScore();
        }
      }
      // collision
      rigLocalPosition.y = 0;
      this.velocity.reflect(new THREE.Vector3(0, 1, 0));
      this.velocity.multiplyScalar(this.data.bounce);
    }

    // apply webs
    if (AFRAME.utils.device.checkHeadsetConnected()) {
      // vr mode right hand
      if (this.rightWeb) {
        let webForce = this.rightWeb.components.web.updateWeb(this.rightHand, rigLocalPosition, timeDeltaSec, "right");
        this.velocity.addScaledVector(webForce, (1 / this.data.mass) * timeDeltaSec);
        // friction
        if (webForce.lengthSq() > 0)
          this.velocity.addScaledVector(this.velocity, -1 * timeDeltaSec * this.data.friction);
      }

      // vr mode left hand
      if (this.leftWeb) {
        let webForce = this.leftWeb.components.web.updateWeb(this.leftHand, rigLocalPosition, timeDeltaSec, "left");
        this.velocity.addScaledVector(webForce, (1 / this.data.mass) * timeDeltaSec);
        // friction
        if (webForce.lengthSq() > 0)
          this.velocity.addScaledVector(this.velocity, -1 * timeDeltaSec * this.data.friction);
      }
    } else {
      // not in vr mode (use mouse and spacebar)
      if (this.rightWeb) {
        let webForce = this.rightWeb.components.web.updateWeb(this.camera, rigLocalPosition, timeDeltaSec, "camera");
        this.velocity.addScaledVector(webForce, (1 / this.data.mass) * timeDeltaSec);
        // friction
        if (webForce.lengthSq() > 0)
          this.velocity.addScaledVector(this.velocity, -1 * timeDeltaSec * this.data.friction);
      }
    }

    // keep camera away from walls
    this.cameraWorldPosition.copy(this.camera.object3D.position);
    this.cameraWorldPosition.add(rigLocalPosition);
    if (this.cameraWorldPosition.distanceTo(this.lastCollisionWorldPosition) < this.data.keepAwayWallsDistance) {
      let lastWallDistance = this.lastCollisionPlane.distanceToPoint(this.cameraWorldPosition);
      if (lastWallDistance < this.data.padding) {
        rigLocalPosition.addScaledVector(this.lastCollisionPlane.normal, this.data.padding - lastWallDistance);
      }

      // keep hands away from walls
      if (AFRAME.utils.device.checkHeadsetConnected()) {
        // right hand
        this.rightHandWorldPosition.copy(this.rightHand.object3D.position);
        this.rightHandWorldPosition.add(rigLocalPosition);
        lastWallDistance = this.lastCollisionPlane.distanceToPoint(this.rightHandWorldPosition);
        if (lastWallDistance < this.data.paddingHand) {
          rigLocalPosition.addScaledVector(this.lastCollisionPlane.normal, this.data.paddingHand - lastWallDistance);
          this.velocity.addScaledVector(
            this.lastCollisionPlane.normal,
            (this.data.paddingHand - lastWallDistance) * this.data.handStrength
          );
        }

        // left hand
        this.leftHandWorldPosition.copy(this.leftHand.object3D.position);
        this.leftHandWorldPosition.add(rigLocalPosition);
        lastWallDistance = this.lastCollisionPlane.distanceToPoint(this.leftHandWorldPosition);
        if (lastWallDistance < this.data.paddingHand) {
          rigLocalPosition.addScaledVector(this.lastCollisionPlane.normal, this.data.paddingHand - lastWallDistance);
          this.velocity.addScaledVector(
            this.lastCollisionPlane.normal,
            (this.data.paddingHand - lastWallDistance) * this.data.handStrength
          );
        }
      }
    }

    // update map
    if (this.map) {
      // choose the web raycasters to update
      let webRaycasters = [this.rightHand.components.raycaster, this.leftHand.components.raycaster];
      if (!AFRAME.utils.device.checkHeadsetConnected()) {
        webRaycasters = [this.camera.components.raycaster];
      }

      // update the map
      let hitCrystal = this.map.components.map.updateMap(
        this.cameraWorldPosition,
        this.velocity,
        velocityRaycaster,
        webRaycasters
      );
      if (hitCrystal) {
        this.scoreValue++;
        this.updateScore();
      }
    }

    const userID = this.el.parentEl.getAttribute("UserID");

    if(multiplayer.checked && !this.madeRequest && (userID>0) && (this.ticks++ % 8 === 0)) {
      if (this.socket === null) {
        this.madeRequest = true;
        this.socket = new WebSocket("wss://9655bb80yh.execute-api.us-east-1.amazonaws.com/production/");
        this.socket.addEventListener("open", (event) => {
          this.madeRequest = false;
        });
        this.socket.addEventListener("message", (event) => {
          const positions = JSON.parse(event.data);
//          this.madeRequest = false;
          let x = 0;
          const currentTime = Date.now();
          for (x = 0; x < positions.length; x++) {
            const player = this.players[x];
            player.setAttribute("position", positions[x]);
            player.timeStamp = currentTime;
            if (player.parentNode === null) {
              this.map.appendChild(player);
            }
          }
          while (x < 30) {
            if (this.players[x].parentNode !== null) {
              this.map.removeChild(this.players[x]);
            }
            x++;
          }
        });

        return;
      }
//      this.madeRequest = true;
      const pos = this.cameraWorldPosition;
      const requestString = 
        {
          "action": "uploadPlayerAndGetOthers",
          "info":{
            "player": userID.toString(),
            "position": pos.x + " " + pos.y + " " + pos.z
          }
        };
      this.socket.send(JSON.stringify(requestString));
    }

    // draw arrows
    const flatCamera =  new THREE.Vector3(this.cameraWorldPosition.x, 0, this.cameraWorldPosition.z);
    for (let x = 0; x < 30; x++) {
      const player = this.players[x];
      const arrow = this.arrows[x];
      if (this.players[x].parentNode === null) {
        if (arrow.parentNode !== null)
          this.el.removeChild(arrow);
        continue;
      }
      if (arrow.parentNode === null)
        this.el.appendChild(arrow);

      const playerPosition = player.getAttribute("position");
      const targetCoordinate = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
      const direction = new THREE.Vector3();
      targetCoordinate.sub(flatCamera).normalize();
      targetCoordinate.y = .8;
      arrow.setAttribute("position", targetCoordinate);
      let scale = 100 / this.cameraWorldPosition.distanceTo(player.getAttribute("position"));
      if (scale > .7)
        scale = .7;
      if (scale < 0.05)
        scale = 0.05;
      arrow.setAttribute("scale", scale + " " + scale + " " + scale);
    }
  }
});
