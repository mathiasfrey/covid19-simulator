'use strict';
(function(){

    // Physics constants
    const SimStepsPerFrame = 1;
    const FrameDelayMillis = 10;

    // Epidemiology
    const POPULATION_SIZE = 500;
    const OVERALL_COMPLIANCE = 0.95;
    const TRANSMISSIBILITY = .5;
    const MORTALITY = .1;
    const DURATION_INFECTED = 10;

    // Measures;
    const VACCINATIONS_PER_DAY = 2;

    // Rendering
    const WIDTH = 800;
    const HEIGHT = 800;

    var sim;
    var day = 0;

    function InitWorld() {
        let sim = new Simulation();
        MakePopulation(sim);
        return sim;
    }

    class Location {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
    }

    class Mobility {
        constructor(dx, dy) {
            this.dx = dx;
            this.dy = dy;

        }
    }

    class C19Status {
        // this helps us model infections and immunity on
        // a personal level
        constructor() {
            this.infected = false;
            this.infectious = false;
            this.convalesced = false;
            this.vaccinated = false;
            this.tested = false;

            this.dayOfInfection = 0;
            this.dayOfVaccination =  Number.MAX_VALUE;;
        }
    }

    class Person {
        constructor(age, location, mobility) {
            this.c19status = new C19Status()

            this.age = age;
            this.location = location;
            this.mobility = mobility;
        }
        setVaccinationDay(vDay) {
            this.c19status.dayOfVaccination = vDay;
        }
        setVaccinated() {
            // console.log(this.c19status.dayOfVaccination);
            if (this.c19status.dayOfVaccination < day) {
                this.c19status.vaccinated = true;
            }
        }
        setInfected() {
            this.c19status.infected = true;
            this.c19status.dayOfInfection = Math.floor(day);
        }
        setConvalesced() {
            this.c19status.infected = false;
            this.c19status.convalesced = true;
        }

        Distance(other_person) {
            const dx = this.location.x - other_person.location.x;
            const dy = this.location.y - other_person.location.y;
            return Math.sqrt(dx*dx + dy*dy);
        }
    }

    function MakePopulation(sim) {

        for (let i=1; i <= POPULATION_SIZE; ++i) {

            let max = 1;
            let min = -1;

            let person = sim.AddPerson(
                new Person(
                    44,
                    new Location(
                        Math.random() * 800, 
                        Math.random() * 800
                    ),
                    new Mobility(
                        10 * Math.random() * (max - min) + min, 
                        10* Math.random() * (max - min) + min
                    )
                )
            );
            // init prevalence            
            if (Math.random() > .95) {
                person.setInfected();
            } 

        }
    }


    class Simulation {
        constructor() {
            this.personList = [];
        }

        StatsInfections() {
            return this.personList.filter(x => x.c19status.infected).length;
        }

        AddPerson(person) {
            this.personList.push(person);
            return person;
        }

        RemovePerson(person) {
            const index = this.personList.indexOf(person);
            if (index > -1) {
              this.personList.splice(index, 1);
            }

        }

        VaccinateAll() {
            
            var i  = 0;
            for (var p of this.personList.filter(x => ! x.c19status.convalesced)) {
                i++;
                var d = Math.floor(i / VACCINATIONS_PER_DAY);
                // console.log('Booking v date for', d);
                p.setVaccinationDay(d);
            }

        }

        ImposeQuarantine() {
            for (var i of this.personList.filter(x => x.c19status.infected)) {
                let compliance = Math.random();
                if (compliance < OVERALL_COMPLIANCE) {
                    i.mobility.dx = 0;
                    i.mobility.dy = 0;
                }
            }
        }

        Update(dt) {

            day += dt;

            // Let the population move around
            for (var p of this.personList) {
                p.location.x += dt * p.mobility.dx;
                p.location.y += dt * p.mobility.dy;

                // Change movement direction in case people want to leave
                // our country
                if (p.location.x < 0 || p.location.x > WIDTH) {
                    p.mobility.dx = p.mobility.dx * -1;
                }
                if (p.location.y < 0 || p.location.y > HEIGHT) {
                    p.mobility.dy = p.mobility.dy * -1;
                }

            }

            // Infection / spread.
            // changes of subject's covid19status
            // loop through infectious
            for (var p of this.personList) {
                
                // only from the perspective of infectious ones
                if (p.c19status.infected) {

                    // loop through succeptible ones
                    for (var s of this.personList.filter(
                        x => ! (x.c19status.infected || x.c19status.convalesced || x.c19status.vaccinated)
                        )) {
                        // console.log('inf:', i, 'succ', s);
                        // get distance
                        // console.log(i.Distance(s));
                        if (p.Distance(s) < 5) {
                            s.setInfected();
                            // console('I!');
                        }
                    }

                    // update health statuses of infected
                    if (p.c19status.dayOfInfection + DURATION_INFECTED < day) {
                        // dies
                        if (Math.random() < MORTALITY) {
                            this.RemovePerson(p);
                        } else {
                            p.setConvalesced();
                        }
                        // console.log(i);
                    }
                }
                // in case someone changes the vacc status
                p.setVaccinated();

            }
        }
    }

    function Render(sim) {
        const canvas = document.getElementById('SimCanvas');
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        context.strokeStyle = '#03f';
        context.lineWidth = 2;
        const pixelRadius = 5;
        
        const colorNotInfected = '#fff';
        const colorInfected = '#f00';
        const colorConvalesced  = '#090';
        const colorVaccinated = '#333';

        for (let p of sim.personList) {

            if (p.c19status.infected) {
                context.fillStyle = colorInfected;
            }  else if (p.c19status.convalesced) {
                context.fillStyle = colorConvalesced;
            }  else if (p.c19status.vaccinated) {
                context.fillStyle = colorVaccinated;
            } else {
                context.fillStyle = colorNotInfected;
            }
            context.beginPath();
            context.arc(p.location.x, p.location.y, pixelRadius, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
            // console.log(p.location);
        }

        // dashboard
        var prevalence = document.getElementById('Prevalence');
        prevalence.innerText = sim.StatsInfections();

        //  days
        document.getElementById('Days').innerText = Math.floor(day);

    }


    function AnimationFrame() {
        const dt = (0.001 * FrameDelayMillis) / SimStepsPerFrame;
        for (let i=0; i < SimStepsPerFrame; ++i) {
            sim.Update(dt);
        }
        Render(sim);
        window.setTimeout(AnimationFrame, FrameDelayMillis);
    }

    function OnMouseDown(evt) {
        console.log("clicked");
        // const canvas = document.getElementById('SimCanvas');
        // const hor = evt.pageX - canvas.offsetLeft;
        // const ver = evt.pageY - canvas.offsetTop;
        // const x = WorldX(hor);
        // const y = WorldY(ver);
        // sim.Grab(x, y);
    }

    function OnMouseUp(evt) {
        // sim.Release();
    }

    function OnMouseMove(evt) {
        // const canvas = document.getElementById('SimCanvas');
        // const hor = evt.pageX - canvas.offsetLeft;
        // const ver = evt.pageY - canvas.offsetTop;
        // const x = WorldX(hor);
        // const y = WorldY(ver);
        // sim.Pull(x, y);
    }

    function OnMouseLeave() {
        //sim.Release();
    }

    window.onload = function() {
        sim = InitWorld();
        const canvas = document.getElementById('SimCanvas');
        canvas.addEventListener('mousedown', OnMouseDown);
        canvas.addEventListener('mouseup', OnMouseUp);
        canvas.addEventListener('mousemove', OnMouseMove);
        canvas.addEventListener('mouseleave', OnMouseLeave);

        
        // restart the app
        document.getElementById('Restart').addEventListener(
            'click', 
            function(){ sim = InitWorld(); }
        );

        document.getElementById('Quarantine').addEventListener(
            'click',
            function(){ sim.ImposeQuarantine(); }
        );

        document.getElementById('VaccinateAll').addEventListener(
            'click',
            function(){ sim.VaccinateAll(); }
        );

        AnimationFrame();
    }

})();