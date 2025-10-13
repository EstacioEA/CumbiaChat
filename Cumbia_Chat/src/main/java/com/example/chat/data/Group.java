package com.example.chat.data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Group {
    private final String name;
    private final List<User> members = Collections.synchronizedList(new ArrayList<>());

    public Group(String name, User creator) {
        this.name = name;
        if (creator != null) members.add(creator);
    }

    public String getName() { return name; }
    public List<User> getMembers() { return members; }

    public void addMember(User u) {
        if (!members.contains(u)) members.add(u);
    }

    public void removeMember(User u) {
        members.remove(u);
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(name).append(" (").append(members.size()).append(")\n");
        for (User u : members) sb.append(" - ").append(u.getUsername()).append("\n");
        return sb.toString();
    }
}
