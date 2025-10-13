package com.example.chat.data;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Representa un grupo de chat.
 * Almacena el nombre del grupo y los usuarios que pertenecen a él.
 */
public class Group implements Serializable {
    private String groupName;
    private List<User> members;

    public Group(String groupName) {
        this.groupName = groupName;
        this.members = new ArrayList<>();
    }

    public String getGroupName() {
        return groupName;
    }

    public List<User> getMembers() {
        return members;
    }

    public void addMember(User user) {
        if (!members.contains(user)) {
            members.add(user);
        }
    }

    public void removeMember(User user) {
        members.remove(user);
    }

    public boolean hasMember(User user) {
        return members.contains(user);
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Grupo: ").append(groupName).append("\nMiembros:\n");
        for (User u : members) {
            sb.append(" - ").append(u.getUsername()).append("\n");
        }
        return sb.toString();
    }
}
